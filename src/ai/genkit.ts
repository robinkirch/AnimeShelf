import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

// Flows run server-side ('use server'), where the user's key from localStorage is not reachable.
// The client therefore passes the key with each request (see searchAnimeWithAi); the plugin falls
// back to GEMINI_API_KEY / GOOGLE_API_KEY / GOOGLE_GENAI_API_KEY from the environment otherwise.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-latest';

const hasEnvApiKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY);

export const ai = genkit({
  // apiKey: false = no key at plugin level; each request must pass config.apiKey.
  plugins: [googleAI(hasEnvApiKey ? {} : { apiKey: false })],
  model: googleAI.model(GEMINI_MODEL),
});
