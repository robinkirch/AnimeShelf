import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';
import {anthropic} from '@genkit-ai/anthropic';
import {DEFAULT_AI_MODEL_ID} from '@/ai/models';

// Flows run server-side ('use server'), where the user's key from localStorage is not reachable.
// The client therefore passes the key with each request (config.apiKey, see searchAnimeWithAi); the plugins
// fall back to their environment variables otherwise (GEMINI_API_KEY / GOOGLE_API_KEY / ANTHROPIC_API_KEY).
// Used when a Gemini model is overloaded (HTTP 503 / UNAVAILABLE), which happens regularly during demand spikes.
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || 'gemini-flash-lite-latest';

const hasGeminiEnvKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENAI_API_KEY);
const hasAnthropicEnvKey = Boolean(process.env.ANTHROPIC_API_KEY);

export const ai = genkit({
  // apiKey: false = no key at plugin level (the plugins would throw at startup otherwise);
  // each request must then pass config.apiKey.
  plugins: [
    googleAI(hasGeminiEnvKey ? {} : { apiKey: false }),
    anthropic(hasAnthropicEnvKey ? {} : { apiKey: false }),
  ],
  model: DEFAULT_AI_MODEL_ID,
});
