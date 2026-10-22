import axios, { type AxiosError } from 'axios';
import type { JikanAPISearchResponse, JikanAPIByIdResponse, JikanAPISeasonsResponse, JikanAnime, JikanAPIRelationsResponse, JikanAnimeRelation } from '@/types/anime';
import { rendererLogger } from './logger';

// The public Jikan API (api.jikan.moe/v4) was shut down on 2026-10-01. Tenrai serves the same
// Jikan v4 paths and response schema, so only the base URL changes. Override via NEXT_PUBLIC_ANIME_API_BASE.
const JIKAN_API_BASE = process.env.NEXT_PUBLIC_ANIME_API_BASE || 'https://api.tenrai.org/v1';

// Tenrai allows 4 requests/second and 120 requests/minute per IP. All requests go through one
// serialized queue so concurrent callers (cards, pages, background loops) can't burst past it.
const MIN_REQUEST_INTERVAL_MS = 300;
const MAX_REQUESTS_PER_MINUTE = 110;
const MAX_RETRIES = 4;
const REQUEST_TIMEOUT_MS = 20000;
const MAX_SEASON_PAGES = 30; // /seasons/upcoming currently has ~17 pages
const MAX_CACHE_ENTRIES = 2000;

const TTL_SHORT = 15 * 60 * 1000;
const TTL_LONG = 6 * 60 * 60 * 1000;

export type JikanPriority = 'high' | 'low';

export interface JikanRequestOptions {
  /** 'high' for things the user is waiting on (search, season list), 'low' for background enrichment. */
  priority?: JikanPriority;
  /** Aborting removes the request from the queue if it hasn't started yet. */
  signal?: AbortSignal;
}

export class JikanApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = 'JikanApiError';
  }
}

export function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

const createAbortError = () => {
  const error = new Error('Jikan request aborted');
  error.name = 'AbortError';
  return error;
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Waiter {
  resolve: (value: any) => void;
  reject: (error: unknown) => void;
}

interface Task {
  key: string;
  path: string;
  params?: Record<string, string | number>;
  ttl: number;
  priority: JikanPriority;
  waiters: Set<Waiter>;
  started: boolean;
}

const queues: Record<JikanPriority, Task[]> = { high: [], low: [] };
const pendingTasks = new Map<string, Task>();
const cache = new Map<string, { data: unknown; expires: number }>();
const recentRequestStarts: number[] = [];
let lastRequestStart = 0;
let isPumping = false;

function buildKey(path: string, params?: Record<string, string | number>): string {
  if (!params) return path;
  const query = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return `${path}?${query}`;
}

function readCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expires < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.data as T;
}

function writeCache(key: string, data: unknown, ttl: number) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, { data, expires: Date.now() + ttl });
}

async function waitForRateLimitSlot() {
  const now = Date.now();
  while (recentRequestStarts.length && now - recentRequestStarts[0] > 60000) recentRequestStarts.shift();

  let wait = Math.max(0, lastRequestStart + MIN_REQUEST_INTERVAL_MS - now);
  if (recentRequestStarts.length >= MAX_REQUESTS_PER_MINUTE) {
    wait = Math.max(wait, recentRequestStarts[0] + 60000 - now);
  }
  if (wait > 0) await delay(wait);

  lastRequestStart = Date.now();
  recentRequestStarts.push(lastRequestStart);
}

function isRetryable(status: number | undefined): boolean {
  // undefined = network error / timeout
  return status === undefined || status === 429 || status >= 500;
}

async function executeTask(task: Task): Promise<unknown> {
  const fullUrl = `${JIKAN_API_BASE}${task.path}`;

  for (let attempt = 0; ; attempt++) {
    await waitForRateLimitSlot();
    const startTime = Date.now();
    try {
      const response = await axios.get(fullUrl, { params: task.params, timeout: REQUEST_TIMEOUT_MS });
      rendererLogger.debug(`Jikan API Response: ${fullUrl}`, {
        category: 'jikan-api',
        status: response.status,
        durationMs: Date.now() - startTime,
        params: task.params ? JSON.stringify(task.params) : undefined,
      });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status;

      if (attempt < MAX_RETRIES && isRetryable(status)) {
        // Retry-After is in seconds; otherwise exponential backoff (1s, 2s, 4s, 8s).
        const retryAfterHeader = Number(axiosError.response?.headers?.['retry-after']);
        const backoffMs = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
          ? Math.min(retryAfterHeader * 1000, 30000)
          : 1000 * 2 ** attempt;
        rendererLogger.warn(`Jikan API ${status ?? 'network error'} for ${fullUrl}, retrying in ${backoffMs}ms (attempt ${attempt + 1}/${MAX_RETRIES})`, {
          category: 'jikan-api',
        });
        // Holding the queue during backoff is intentional: a 429 means everyone should slow down.
        await delay(backoffMs);
        continue;
      }

      rendererLogger.error(`Jikan API Error: ${fullUrl}`, {
        category: 'jikan-api',
        status,
        errorMessage: axiosError.message,
        durationMs: Date.now() - startTime,
      });
      throw new JikanApiError(
        status === 429
          ? 'Anime API rate limit reached. Please wait a moment and try again.'
          : status === 403
            // Tenrai's anti-abuse system blocks the IP (usually clears within 24 hours).
            ? 'Access to the anime API is temporarily blocked (HTTP 403). This usually clears within 24 hours.'
            : `Anime API request failed${status ? ` (HTTP ${status})` : ''}: ${axiosError.message}`,
        status,
      );
    }
  }
}

function dequeue(): Task | undefined {
  return queues.high.shift() ?? queues.low.shift();
}

async function pump() {
  if (isPumping) return;
  isPumping = true;
  try {
    let task: Task | undefined;
    while ((task = dequeue())) {
      if (task.waiters.size === 0) {
        pendingTasks.delete(task.key);
        continue;
      }
      task.started = true;
      try {
        const data = await executeTask(task);
        writeCache(task.key, data, task.ttl);
        task.waiters.forEach(w => w.resolve(data));
      } catch (error) {
        task.waiters.forEach(w => w.reject(error));
      } finally {
        pendingTasks.delete(task.key);
      }
    }
  } finally {
    isPumping = false;
  }
}

function removeFromQueue(task: Task) {
  const queue = queues[task.priority];
  const index = queue.indexOf(task);
  if (index !== -1) queue.splice(index, 1);
}

function jikanRequest<T>(path: string, params: Record<string, string | number> | undefined, ttl: number, options: JikanRequestOptions = {}): Promise<T> {
  const { priority = 'low', signal } = options;
  const key = buildKey(path, params);

  const cached = readCache<T>(key);
  if (cached !== undefined) return Promise.resolve(cached);
  if (signal?.aborted) return Promise.reject(createAbortError());

  let task = pendingTasks.get(key);
  if (!task) {
    task = { key, path, params, ttl, priority, waiters: new Set(), started: false };
    pendingTasks.set(key, task);
    queues[priority].push(task);
  } else if (priority === 'high' && task.priority === 'low' && !task.started) {
    removeFromQueue(task);
    task.priority = 'high';
    queues.high.push(task);
  }

  const currentTask = task;
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      currentTask.waiters.delete(waiter);
      if (currentTask.waiters.size === 0 && !currentTask.started) {
        removeFromQueue(currentTask);
        pendingTasks.delete(currentTask.key);
      }
      reject(createAbortError());
    };
    const waiter: Waiter = {
      resolve: value => { signal?.removeEventListener('abort', onAbort); resolve(value); },
      reject: error => { signal?.removeEventListener('abort', onAbort); reject(error); },
    };
    currentTask.waiters.add(waiter);
    signal?.addEventListener('abort', onAbort, { once: true });
    void pump();
  });
}

function dedupeByMalId(animeList: JikanAnime[]): JikanAnime[] {
  // Jikan sometimes returns the same entry twice (also across pages), which breaks React keys.
  return Array.from(new Map(animeList.map(anime => [anime.mal_id, anime])).values());
}

async function fetchAllSeasonPages(path: string, options: JikanRequestOptions): Promise<JikanAnime[]> {
  const all: JikanAnime[] = [];
  for (let page = 1; page <= MAX_SEASON_PAGES; page++) {
    const response = await jikanRequest<JikanAPISeasonsResponse>(path, { page }, TTL_SHORT, options);
    all.push(...(response?.data ?? []));
    if (!response?.pagination?.has_next_page) break;
  }
  return dedupeByMalId(all);
}

export const jikanApi = {
  /** Throws JikanApiError on failure. */
  searchAnime: async (query: string, limit: number = 20, options: JikanRequestOptions = {}): Promise<JikanAnime[]> => {
    const response = await jikanRequest<JikanAPISearchResponse>('/anime', { q: query, limit }, TTL_SHORT, { priority: 'high', ...options });
    return response?.data || [];
  },

  /** Returns null on failure (except abort, which rethrows). */
  getAnimeById: async (id: number, options: JikanRequestOptions = {}): Promise<JikanAnime | null> => {
    try {
      const response = await jikanRequest<JikanAPIByIdResponse>(`/anime/${id}`, undefined, TTL_LONG, options);
      return response?.data || null;
    } catch (error) {
      if (isAbortError(error)) throw error;
      return null;
    }
  },

  /** Fetches all pages of the currently airing season. Throws JikanApiError on failure. */
  getCurrentSeason: async (options: JikanRequestOptions = {}): Promise<JikanAnime[]> => {
    return fetchAllSeasonPages('/seasons/now', { priority: 'high', ...options });
  },

  /** Fetches all pages of announced, not yet aired anime. Throws JikanApiError on failure. */
  getUpcomingSeason: async (options: JikanRequestOptions = {}): Promise<JikanAnime[]> => {
    return fetchAllSeasonPages('/seasons/upcoming', { priority: 'high', ...options });
  },

  /** Fetches all pages of the given season. Throws JikanApiError on failure. */
  getSeason: async (year: number, season: string, options: JikanRequestOptions = {}): Promise<JikanAnime[]> => {
    return fetchAllSeasonPages(`/seasons/${year}/${season}`, { priority: 'high', ...options });
  },

  /** Throws JikanApiError on failure, so callers don't mistake an API error for "no relations". */
  getAnimeRelations: async (id: number, options: JikanRequestOptions = {}): Promise<JikanAnimeRelation[]> => {
    const response = await jikanRequest<JikanAPIRelationsResponse>(`/anime/${id}/relations`, undefined, TTL_LONG, options);
    return response?.data || [];
  },
};
