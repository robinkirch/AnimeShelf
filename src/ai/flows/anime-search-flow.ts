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
    // The tool directly returns an array of JikanAnime objects.
    // Genkit will validate this against JikanAnimeSchema.
    outputSchema: z.array(JikanAnimeSchema).describe("An array of anime found, or an empty array if no results or an error occurred. Each anime object contains details like title, synopsis, MAL ID, etc."),
  },
  async (input) => {
    try {
      // Limit results from tool to keep things manageable for the LLM, e.g., top 5.
      const results: JikanAnime[] = await jikanApi.searchAnime(input.searchTerm, 5);
      // The results from jikanApi.searchAnime are expected to be JikanAnime[].
      // We rely on Zod in defineTool to validate this against JikanAnimeSchema.
      return results;
    } catch (error) {
      console.error(`Error in searchAnimeOnJikanTool with term "${input.searchTerm}":`, error);
      // Return empty array on error to allow LLM to potentially try other terms or indicate no results.
      return [];
    }
  }
);

const animeSearchPrompt = ai.definePrompt({
  name: 'animeSearchPrompt',
  input: { schema: AiSearchInputSchema },
  output: { schema: AiSearchOutputSchema }, // Expects an array of JikanAnime objects
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
    outputSchema: AiSearchOutputSchema, // Expects Promise<JikanAnime[]>
  },
  async (input: AiSearchInput): Promise<JikanAnime[]> => {
    const { output } = await animeSearchPrompt(input);
    
    if (!output) {
      console.warn("AI search flow's prompt returned undefined output. Returning an empty array.");
      return [];
    }
    // The 'output' here is already expected to be JikanAnime[] because
    // animeSearchPrompt's output.schema is AiSearchOutputSchema (z.array(JikanAnimeSchema)).
    // Genkit handles the parsing and validation.
    return output;
  }
);

/**
 * Takes a natural language query and returns a list of matching anime.
 * @param input - An object containing the natural language query.
 * @returns A promise that resolves to an array of JikanAnime objects.
 */
export async function searchAnimeWithAi(input: AiSearchInput): Promise<JikanAnime[]> {
  try {
    const results: AiSearchOutput = await animeSearchFlow(input);
    // Ensure results are always an array, even if flow somehow returns non-array 
    // (should not happen with Zod schema validation in place).
    return Array.isArray(results) ? results : [];
  } catch (error) {
    console.error("Error executing searchAnimeWithAi flow:", error);
    // Propagate the error or return an empty array depending on desired UI behavior.
    // Returning an empty array for now to allow the UI to display "no results" or a generic error.
    return []; 
  }
}

