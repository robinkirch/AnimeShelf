// Language settings shared by server (layout reads the cookie) and client (I18nProvider, settings).

export const LANGUAGES = ['en', 'de'] as const;
export type Language = (typeof LANGUAGES)[number];

/** Used whenever no (valid) language is stored and for every text missing in another language. */
export const DEFAULT_LANGUAGE: Language = 'en';

/** Stored as a cookie (not localStorage) so the server renders the app in the right language from the start. */
export const LANGUAGE_COOKIE = 'animeShelfLanguage';

export const LANGUAGE_LABELS: Record<Language, string> = {
  en: 'English',
  de: 'Deutsch',
};

/** BCP 47 locales for date and number formatting. */
export const LANGUAGE_LOCALES: Record<Language, string> = {
  en: 'en-US',
  de: 'de-DE',
};

export function normalizeLanguage(value: string | null | undefined): Language {
  return LANGUAGES.includes(value as Language) ? (value as Language) : DEFAULT_LANGUAGE;
}
