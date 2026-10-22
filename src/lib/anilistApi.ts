import axios, { type AxiosError } from 'axios';
import { rendererLogger } from './logger';

// AniList GraphQL API: unlike Jikan/Tenrai it can fetch the relations of up to 50 anime (by MAL ID) in one
// request, including status and dates of every related entry. Used to find related anime quickly.
const ANILIST_API_URL = 'https://graphql.anilist.co';
const BATCH_SIZE = 50;
// AniList currently allows 30 requests/minute (normally 90). Batches are sent sequentially with a small gap.
const MIN_REQUEST_INTERVAL_MS = 700;
const MAX_RETRIES = 3;
const CACHE_TTL_MS = 15 * 60 * 1000;

export type AniListMediaStatus = 'FINISHED' | 'RELEASING' | 'NOT_YET_RELEASED' | 'CANCELLED' | 'HIATUS';

export interface AniListRelatedNode {
  idMal: number | null;
  type: 'ANIME' | 'MANGA';
  format: string | null;
  status: AniListMediaStatus | null;
  season: string | null;
  seasonYear: number | null;
  startDate: { year: number | null; month: number | null; day: number | null };
  title: { romaji: string | null; english: string | null };
  coverImage: { large: string | null };
}

export interface AniListRelationEdge {
  relationType: string;
  node: AniListRelatedNode;
}

export class AniListApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'AniListApiError';
  }
}

const RELATIONS_QUERY = `query ($ids: [Int]) {
  Page(page: 1, perPage: ${BATCH_SIZE}) {
    media(idMal_in: $ids, type: ANIME) {
      idMal
      relations {
        edges {
          relationType
          node {
            idMal type format status season seasonYear
            startDate { year month day }
            title { romaji english }
            coverImage { large }
          }
        }
      }
    }
  }
}`;

const relationsCache = new Map<number, { edges: AniListRelationEdge[]; expires: number }>();
let lastRequestStart = 0;

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const createAbortError = () => {
  const error = new Error('AniList request aborted');
  error.name = 'AbortError';
  return error;
};

async function postBatch(malIds: number[], signal?: AbortSignal): Promise<Array<{ malId: number; edges: AniListRelationEdge[] }>> {
  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestStart + MIN_REQUEST_INTERVAL_MS - Date.now();
    if (wait > 0) await delay(wait);
    if (signal?.aborted) throw createAbortError();
    lastRequestStart = Date.now();

    try {
      const response = await axios.post(
        ANILIST_API_URL,
        { query: RELATIONS_QUERY, variables: { ids: malIds } },
        { headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, timeout: 20000, signal },
      );
      if (response.data?.errors?.length) {
        throw new AniListApiError(`AniList query error: ${response.data.errors[0].message}`);
      }
      const media: Array<{ idMal: number | null; relations: { edges: AniListRelationEdge[] } }> = response.data?.data?.Page?.media ?? [];
      return media
        .filter((m): m is { idMal: number; relations: { edges: AniListRelationEdge[] } } => m.idMal !== null)
        .map(m => ({ malId: m.idMal, edges: m.relations.edges }));
    } catch (error) {
      if (axios.isCancel(error) || (error instanceof Error && error.name === 'CanceledError')) throw createAbortError();
      if (error instanceof AniListApiError) throw error;
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;
      const retryable = status === undefined || status === 429 || status >= 500;
      if (attempt < MAX_RETRIES && retryable) {
        const retryAfter = Number(axiosError.response?.headers?.['retry-after']);
        const backoffMs = Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 60000) : 1000 * 2 ** attempt;
        rendererLogger.warn(`AniList ${status ?? 'network error'}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`, { category: 'anilist-api' });
        await delay(backoffMs);
        continue;
      }
      rendererLogger.error('AniList request failed', { category: 'anilist-api', status, errorMessage: axiosError.message });
      throw new AniListApiError(`AniList request failed${status ? ` (HTTP ${status})` : ''}: ${axiosError.message}`, status);
    }
  }
}

export const anilistApi = {
  /**
   * Returns the relation edges for each given MAL ID (IDs unknown to AniList are missing from the map).
   * Uncached IDs are fetched in batches of 50. Throws AniListApiError on failure, AbortError on abort.
   */
  getRelationsByMalIds: async (
    malIds: number[],
    options: { signal?: AbortSignal; onProgress?: (doneBatches: number, totalBatches: number) => void } = {},
  ): Promise<Map<number, AniListRelationEdge[]>> => {
    const result = new Map<number, AniListRelationEdge[]>();
    const now = Date.now();
    const uncached: number[] = [];
    for (const id of new Set(malIds)) {
      const cached = relationsCache.get(id);
      if (cached && cached.expires > now) result.set(id, cached.edges);
      else uncached.push(id);
    }

    const batches: number[][] = [];
    for (let i = 0; i < uncached.length; i += BATCH_SIZE) batches.push(uncached.slice(i, i + BATCH_SIZE));
    options.onProgress?.(0, batches.length);

    for (const [index, batch] of batches.entries()) {
      const fetched = await postBatch(batch, options.signal);
      const expires = Date.now() + CACHE_TTL_MS;
      for (const { malId, edges } of fetched) {
        relationsCache.set(malId, { edges, expires });
        result.set(malId, edges);
      }
      options.onProgress?.(index + 1, batches.length);
    }
    return result;
  },
};
