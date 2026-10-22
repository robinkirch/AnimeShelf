// AI models selectable for the AI search (settings). Shared by client (settings, search) and server (flow);
// the server only accepts IDs from this list. IDs use Genkit's "<plugin>/<model>" naming.

import type { Messages } from '@/i18n/messages/en';

export type AiProvider = 'gemini' | 'anthropic';

export interface AiModelOption {
  id: string;
  provider: AiProvider;
  /** Product name, not translated. */
  label: string;
  /** Key of the translated description (settings.aiModelDescriptions). */
  descriptionKey: keyof Messages['settings']['aiModelDescriptions'];
}

export const AI_PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Google Gemini',
  anthropic: 'Anthropic Claude',
};

export const AI_MODELS: AiModelOption[] = [
  { id: 'googleai/gemini-flash-latest', provider: 'gemini', label: 'Gemini Flash (latest)', descriptionKey: 'geminiFlash' },
  { id: 'googleai/gemini-flash-lite-latest', provider: 'gemini', label: 'Gemini Flash-Lite (latest)', descriptionKey: 'geminiFlashLite' },
  { id: 'googleai/gemini-pro-latest', provider: 'gemini', label: 'Gemini Pro (latest)', descriptionKey: 'geminiPro' },
  { id: 'anthropic/claude-opus-5-5', provider: 'anthropic', label: 'Claude Opus 5.5', descriptionKey: 'claudeOpus' },
  { id: 'anthropic/claude-sonnet-5-5', provider: 'anthropic', label: 'Claude Sonnet 5.5', descriptionKey: 'claudeSonnet' },
  { id: 'anthropic/claude-haiku-5-5', provider: 'anthropic', label: 'Claude Haiku 5.5', descriptionKey: 'claudeHaiku' },
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
