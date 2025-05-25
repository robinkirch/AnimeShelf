
import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/googleai';

const getApiKey = (): string | undefined => {
  // This function will be called by the googleAI plugin.
  // It needs to run client-side to access localStorage.
  // Genkit flows are 'use server', but the plugin initialization happens where genkit() is called.
  // If genkit() is part of the client bundle or can access client environment, this works.
  // For Next.js, plugin initialization typically occurs when the module is loaded.
  if (typeof window !== 'undefined') {
    return localStorage.getItem('geminiApiKey') || undefined;
  }
  // Fallback for server-side environments if needed, though primarily for client-set key
  // The environment variables GOOGLE_API_KEY or GOOGLE_GENAI_API_KEY would be used by default
  // by the plugin if apiKey function returns undefined or is not provided.
  // So, returning undefined here if not in window context is fine.
  return undefined;
};

export const ai = genkit({
  plugins: [
    googleAI({
        apiKey: getApiKey, // Pass the function that retrieves the key
    })
  ],
  model: 'googleai/gemini-2.0-flash', // Default model, can be overridden in specific prompts/flows
});
