
'use server';
/**
 * @fileOverview AI-powered anime search flow.
 *
 * - searchAnimeWithAi - A function that takes a natural language query and returns matching anime.
 * - AiSearchInput - The input type for the searchAnimeWithAi function.
 * - AiSearchOutput - The output type for the searchAnimeWithAi function (which is JikanAnime[]).
 */

import { ai } from '@/ai/genkit';
import { jikanApi } from '@/lib/jikanApi';
import type { JikanAnime } from '@/types/anime';
import { JikanAnimeSchema } from '@/types/jikanApiSchemas';
import { z } from 'genkit';
import { rendererLogger } from '@/lib/logger'; // Import renderer logger if contextually appropriate (for client-side calls)
// Note: If this flow is ONLY called server-side, rendererLogger won't work.
// For now, assuming calls might originate from client actions that can then log.


const AiSearchInputSchema = z.object({
  query: z.string().describe('The natural language description of the anime the user is looking for.'),
});
export type AiSearchInput = z.infer<typeof AiSearchInputSchema>;

// Output is an array of JikanAnime objects, matching the structure from Jikan API.
const AiSearchOutputSchema = z.array(JikanAnimeSchema);
export type AiSearchOutput = z.infer<typeof AiSearchOutputSchema>;


const searchAnimeOnJikanTool = ai.defineTool(
  {
    name: 'searchAnimeOnJikanTool',
    description: 'Searches for anime on MyAnimeList (via Jikan API) based on a search term. Use this tool to find anime based on keywords, titles, or specific characteristics mentioned by the user. Returns an array of anime objects.',
    inputSchema: z.object({
      searchTerm: z.string().describe('A concise search term, anime title, or keywords to search for.'),
    }),
    outputSchema: z.array(JikanAnimeSchema).describe("An array of anime found, or an empty array if no results or an error occurred. Each anime object contains details like title, synopsis, MAL ID, etc."),
  },
  async (input) => {
    // This tool is part of a server-side flow, so rendererLogger cannot be used directly here.
    // Logging related to this tool's execution would typically be done in the main Genkit flow or the calling Jikan API.
    // console.log(`[AI Tool: searchAnimeOnJikanTool] Searching for: ${input.searchTerm}`); // Basic console log for server
    try {
      const results: JikanAnime[] = await jikanApi.searchAnime(input.searchTerm, 5);
      // console.log(`[AI Tool: searchAnimeOnJikanTool] Found ${results.length} results for: ${input.searchTerm}`);
      return results;
    } catch (error: any) {
      // console.error(`[AI Tool: searchAnimeOnJikanTool] Error for term "${input.searchTerm}":`, error.message);
      return []; // Return empty array on error as per description
    }
  }
);

const animeSearchPrompt = ai.definePrompt({
  name: 'animeSearchPrompt',
  input: { schema: AiSearchInputSchema },
  output: { schema: AiSearchOutputSchema }, 
  tools: [searchAnimeOnJikanTool],
  system: `You are an expert AI assistant specializing in anime. Your goal is to help users find anime based on their natural language descriptions.
You have access to a tool called 'searchAnimeOnJikanTool' that can search MyAnimeList.

Instructions:
1.  Carefully analyze the user's query: \`{{{query}}}\`
2.  Extract key characteristics, themes, genres, character descriptions, or potential titles from the user's query.
3.  Use the 'searchAnimeOnJikanTool' to search for anime. You can make multiple calls to the tool with different refined search terms if the initial search is not specific enough or if the user's query is broad. For instance, if the user asks for "an anime about a detective who solves supernatural cases", you might first search for "detective supernatural cases anime".
4.  Critically evaluate the search results obtained from the tool. Ensure they genuinely match the user's original description.
5.  Filter and select the most relevant anime (up to a maximum of 5) that directly and strongly match the user's query. Prioritize anime that are well-known and highly relevant to the description.
6.  If you find multiple highly relevant anime, include them in your response.
7.  If, after using the tool, you cannot find any relevant anime, you MUST return an empty list.
8.  Do not invent anime. Only return anime found through the tool that you assess as relevant to the user's query.
9.  Your final response MUST be an array of anime objects. Each object in the array must conform to the JikanAnimeSchema structure. If no anime are found, return an empty array ([]).

Example user query: "A black swordsman fighting in an online vrmmorpg"
You might use the tool with search terms like "black swordsman vrmmorpg", "kirito sao", or "Sword Art Online".
Then, from the tool's results, you would select "Sword Art Online" and any other highly relevant entries, format them according to JikanAnimeSchema, and return them as an array.

Other Example user query: "An anime about a group of heroes trying to save the world from a demon lord."
You might use the tool with search terms like "fantasy demon lord heroes", "isekai save world", or "adventure fantasy".
Then, from the tool's results, you would select highly relevant entries that match the description (e.g., "Maoyu", "The Devil is a Part-Timer!", "Overlord"), format them according to JikanAnimeSchema, and return them as an array.
`,
  prompt: `User query: {{{query}}}

Based on this query, identify and return the most relevant anime using the available tools.
Your final output must be an array of JikanAnime objects.
`,
});


const animeSearchFlow = ai.defineFlow(
  {
    name: 'animeSearchFlow',
    inputSchema: AiSearchInputSchema,
    outputSchema: AiSearchOutputSchema, 
  },
  async (input: AiSearchInput): Promise<JikanAnime[]> => {
    // Server-side flow: cannot use rendererLogger here directly.
    // Logging the start and end of this flow, and its inputs/outputs,
    // would typically be done using a server-side logger if Genkit is run in a Node.js env
    // OR by the calling client-side function.
    // For example: console.log(`[AI Flow: animeSearchFlow] Input: ${input.query}`);

    const { output } = await animeSearchPrompt(input);
    
    if (!output) {
      // console.warn("[AI Flow: animeSearchFlow] Prompt returned undefined output. Returning empty array.");
      return [];
    }
    // console.log(`[AI Flow: animeSearchFlow] Output: ${output.length} anime found.`);
    return output;
  }
);

export async function searchAnimeWithAi(input: AiSearchInput): Promise<JikanAnime[]> {
  // This function is exported and might be called from the client-side.
  // So, we can use rendererLogger here.
  rendererLogger.info(`Initiating AI anime search.`, { category: 'ai-search', query: input.query });
  try {
    const results: AiSearchOutput = await animeSearchFlow(input);
    rendererLogger.info(`AI anime search completed. Found ${results.length} results.`, { category: 'ai-search', query: input.query, resultsCount: results.length });
    return Array.isArray(results) ? results : [];
  } catch (error: any) {
    rendererLogger.error("Error executing searchAnimeWithAi flow.", { category: 'ai-search-error', query: input.query, error: error.message, stack: error.stack });
    return []; 
  }
}
