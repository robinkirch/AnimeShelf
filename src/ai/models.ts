// AI models selectable for the AI search (settings). Shared by client (settings, search) and server (flow);
// the server only accepts IDs from this list. IDs use Genkit's "<plugin>/<model>" naming.

export type AiProvider = 'gemini' | 'anthropic';

export interface AiModelOption {
  id: string;
  provider: AiProvider;
  label: string;
  description: string;
}

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
};

export const AI_MODELS: AiModelOption[] = [
  { id: 'googleai/gemini-flash-latest', provider: 'gemini', label: 'Gemini Flash (latest)', description: 'Fast, good default' },
  { id: 'googleai/gemini-flash-lite-latest', provider: 'gemini', label: 'Gemini Flash-Lite (latest)', description: 'Fastest and cheapest' },
  { id: 'googleai/gemini-pro-latest', provider: 'gemini', label: 'Gemini Pro (latest)', description: 'Most capable Gemini, slower' },
  { id: 'anthropic/claude-opus-5-5', provider: 'anthropic', label: 'Claude Opus 5.5', description: 'Most capable Opus ($4 / $20 per 1M tokens)' },
  { id: 'anthropic/claude-sonnet-5-5', provider: 'anthropic', label: 'Claude Sonnet 5.5', description: 'Balanced ($2 / $10 per 1M tokens)' },
  { id: 'anthropic/claude-haiku-5-5', provider: 'anthropic', label: 'Claude Haiku 5.5', description: 'Fastest and cheapest ($0.10 / $0.50 per 1M tokens)' },
];

export const DEFAULT_AI_MODEL_ID = 'googleai/gemini-flash-latest';

// localStorage keys. 'geminiApiKey' is kept from earlier versions so existing keys keep working.
export const AI_STORAGE_KEYS = {
  model: 'aiModel',
  apiKey: { gemini: 'geminiApiKey', anthropic: 'anthropicApiKey' } satisfies Record<AiProvider, string>,
};

export function getAiModel(id: string | null | undefined): AiModelOption | undefined {
  return AI_MODELS.find(model => model.id === id);
}

/** Selected model and its provider's API key from localStorage (client only). */
export function readStoredAiSettings(): { model: AiModelOption; apiKey: string | null } {
  const model = getAiModel(localStorage.getItem(AI_STORAGE_KEYS.model)) ?? getAiModel(DEFAULT_AI_MODEL_ID)!;
  return { model, apiKey: localStorage.getItem(AI_STORAGE_KEYS.apiKey[model.provider]) };
}
