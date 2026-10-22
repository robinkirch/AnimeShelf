"use client";

import type { ReactNode } from 'react';
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { DEFAULT_LANGUAGE, LANGUAGE_COOKIE, LANGUAGE_LOCALES, type Language } from './config';
import { en, type Messages } from './messages/en';
import { de } from './messages/de';

const MESSAGES: Record<Language, Messages> = { en, de };
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365 * 10;

type PluralForms = { one: string; other: string };
type Join<P extends string, K extends string> = P extends '' ? K : `${P}.${K}`;

/** All dot-separated keys of the English messages, e.g. "shelf.title". */
export type MessageKey<T = Messages, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string | PluralForms ? Join<P, K> : MessageKey<T[K], Join<P, K>>;
}[keyof T & string];

export type TranslationParams = Record<string, string | number>;
export type TranslateFn = (key: MessageKey, params?: TranslationParams) => string;

function lookup(messages: unknown, key: string): string | PluralForms | undefined {
  let node: unknown = messages;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object') return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  if (typeof node === 'string') return node;
  if (node && typeof node === 'object' && 'one' in node && 'other' in node) return node as PluralForms;
  return undefined;
}

function createTranslator(language: Language): TranslateFn {
  const pluralRules = new Intl.PluralRules(LANGUAGE_LOCALES[language]);
  return (key, params) => {
    // Missing texts fall back to English, and to the key itself as a last resort.
    const entry = lookup(MESSAGES[language], key) ?? lookup(MESSAGES[DEFAULT_LANGUAGE], key) ?? key;
    const template = typeof entry === 'string'
      ? entry
      : pluralRules.select(Number(params?.count ?? 0)) === 'one' ? entry.one : entry.other;
    return params ? template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match)) : template;
  };
}

interface I18nContextType {
  language: Language;
  /** BCP 47 locale for Intl / toLocaleString. */
  locale: string;
  setLanguage: (language: Language) => void;
  t: TranslateFn;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider = ({ initialLanguage, children }: { initialLanguage: Language; children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(initialLanguage);

  const setLanguage = useCallback((next: Language) => {
    document.cookie = `${LANGUAGE_COOKIE}=${next}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; samesite=lax`;
    document.documentElement.lang = next;
    setLanguageState(next);
  }, []);

  const value = useMemo<I18nContextType>(() => ({
    language,
    locale: LANGUAGE_LOCALES[language],
    setLanguage,
    t: createTranslator(language),
  }), [language, setLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (context === undefined) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};
