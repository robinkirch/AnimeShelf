'use server';
/**
 * @fileOverview AI-powered anime search flow.
 *
 * - searchAnimeWithAi - A function that takes a natural language query and returns matching anime.
 * - AiSearchInput - The input type for the searchAnimeWithAi function.
 *
 * The model only picks MAL IDs from compact tool results; the full anime objects are loaded
 * afterwards via jikanApi. Letting the model echo complete API objects was slow (30k+ characters
 * per entry), brittle (schema drift) and allowed it to alter the data.
 */

import { googleAI } from '@genkit-ai/google-genai';
import { ai, GEMINI_FALLBACK_MODEL } from '@/ai/genkit';
import { AI_PROVIDER_LABELS, DEFAULT_AI_MODEL_ID, getAiModel } from '@/ai/models';
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime } from '@/types/anime';
import { z } from 'genkit';
import { rendererLogger } from '@/lib/logger';

const MAX_RESULTS = 5;
const SYNOPSIS_MAX_LENGTH = 400;

const AiSearchInputSchema = z.object({
  query: z.string().describe('The natural language description of the anime the user is looking for.'),
});
export type AiSearchInput = z.infer<typeof AiSearchInputSchema> & {
  /** Model ID from the settings (see AI_MODELS); falls back to the default model. */
  modelId?: string;
  /** API key of the selected model's provider from the settings (localStorage); not part of the prompt input. */
  apiKey?: string;
};

const AnimeCandidateSchema = z.object({
  mal_id: z.number().describe('The MyAnimeList ID. Use this value in your answer.'),
  title: z.string(),
  title_english: z.string().nullable(),
  type: z.string().nullable(),
  year: z.number().nullable(),
  genres: z.array(z.string()),
  synopsis: z.string().nullable(),
});

const AiSearchResultSchema = z.object({
  mal_ids: z.array(z.number()).describe(`MyAnimeList IDs of the most relevant anime (at most ${MAX_RESULTS}), best match first.`),
});

const searchAnimeTool = ai.defineTool(
  {
    name: 'searchAnimeTool',
    description: 'Searches MyAnimeList data by title or keywords. Use it to find anime matching characteristics the user describes. Returns compact candidates with their MAL ID.',
    inputSchema: z.object({
      searchTerm: z.string().describe('A concise search term, anime title, or keywords to search for.'),
    }),
    outputSchema: z.array(AnimeCandidateSchema),
  },
  async ({ searchTerm }) => {
    try {
      const results = await jikanApi.searchAnime(searchTerm, 8);
      return results.map(anime => ({
        mal_id: anime.mal_id,
        title: anime.title,
        title_english: anime.title_english ?? null,
        type: anime.type ?? null,
        year: anime.year ?? null,
        genres: anime.genres?.map(g => g.name) ?? [],
        synopsis: anime.synopsis ? anime.synopsis.slice(0, SYNOPSIS_MAX_LENGTH) : null,
      }));
    } catch {
      return [];
    }
  }
);

const animeSearchPrompt = ai.definePrompt({
  name: 'animeSearchPrompt',
  input: { schema: AiSearchInputSchema },
  output: { schema: AiSearchResultSchema },
  tools: [searchAnimeTool],
  system: `You are an expert AI assistant specializing in anime. Your goal is to help users find anime based on their natural language descriptions.
You have access to a tool called 'searchAnimeTool' that searches MyAnimeList data and returns candidates with their MAL ID, titles, genres and a short synopsis.

Instructions:
1.  Analyze the user's query and extract key characteristics, themes, genres, character descriptions, or potential titles.
2.  Use 'searchAnimeTool' to search. Make several calls with different, refined search terms (likely titles, keywords) if the query is broad or the first results don't fit.
3.  Critically compare the candidates (especially the synopsis) with the user's description.
4.  Answer with the MAL IDs of the most relevant anime (at most ${MAX_RESULTS}), best match first.
5.  Only use MAL IDs that were returned by the tool. Never invent IDs. If nothing fits, return an empty list.

Example: for "an elf mage who travels after the hero party defeated the demon king" you might search "Frieren", "elf mage journey after demon king" and return the MAL ID of "Sousou no Frieren".`,
  prompt: `User query: {{{query}}}`,
});

const AiSearchFlowInputSchema = AiSearchInputSchema.extend({
  modelId: z.string().optional(),
  apiKey: z.string().optional(),
});

const animeSearchFlow = ai.defineFlow(
  {
    name: 'animeSearchFlow',
    inputSchema: AiSearchFlowInputSchema,
    outputSchema: AiSearchResultSchema,
  },
  async ({ query, modelId, apiKey }) => {
    // Only models from the settings list are accepted.
    const model = getAiModel(modelId) ?? getAiModel(DEFAULT_AI_MODEL_ID)!;
    const config = model.provider === 'anthropic'
      // A search with a few tool calls doesn't need deep reasoning; low effort keeps it fast and cheap.
      ? { ...(apiKey && { apiKey }), output_config: { effort: 'low' } }
      : { ...(apiKey && { apiKey }) };
    try {
      const { output } = await animeSearchPrompt({ query }, { model: model.id, config });
      return output ?? { mal_ids: [] };
    } catch (error) {
      const fallbackModelId = `googleai/${GEMINI_FALLBACK_MODEL}`;
      if (model.provider !== 'gemini' || model.id === fallbackModelId || !isModelOverloaded(error)) throw error;
      const { output } = await animeSearchPrompt({ query }, { model: googleAI.model(GEMINI_FALLBACK_MODEL), config });
      return output ?? { mal_ids: [] };
    }
  }
);

function isModelOverloaded(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /UNAVAILABLE|\b503\b|high demand|overloaded/i.test(message);
}

/** Errors are returned as codes (not thrown): Next.js hides server action error messages in production builds. */
export type AiSearchResult =
  | { results: JikanAnime[] }
  | { error: 'invalidApiKey' | 'overloaded' | 'failed'; provider: string };

export async function searchAnimeWithAi(input: AiSearchInput): Promise<AiSearchResult> {
  rendererLogger.info(`Initiating AI anime search.`, { category: 'ai-search', query: input.query });
  try {
    const { mal_ids } = await animeSearchFlow({ query: input.query, modelId: input.modelId, apiKey: input.apiKey || undefined });
    const uniqueIds = Array.from(new Set(mal_ids)).slice(0, MAX_RESULTS);
    const details = await Promise.all(uniqueIds.map(id => jikanApi.getAnimeById(id, { priority: 'high' })));
    const results = details.filter((anime): anime is JikanAnime => anime !== null);
    rendererLogger.info(`AI anime search completed. Found ${results.length} results.`, { category: 'ai-search', query: input.query, resultsCount: results.length });
    return { results };
  } catch (error: any) {
    rendererLogger.error("Error executing searchAnimeWithAi flow.", { category: 'ai-search-error', query: input.query, error: error.message, stack: error.stack });
    const providerLabel = AI_PROVIDER_LABELS[(getAiModel(input.modelId) ?? getAiModel(DEFAULT_AI_MODEL_ID)!).provider];
    const code = /api.?key|authentication/i.test(error?.message ?? '')
      ? 'invalidApiKey'
      : isModelOverloaded(error) ? 'overloaded' : 'failed';
    return { error: code, provider: providerLabel };
  }
}
