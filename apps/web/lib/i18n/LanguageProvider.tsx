'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';

import {
  DEFAULT_LOCALE,
  LOCALES,
  translations,
  type Locale,
  type TranslationTree,
} from './translations';

const STORAGE_KEY = 'aurex.locale';

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  /** Translate a dot-path key, with optional `{var}` interpolation params. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** Resolve a dot-path (e.g. `overview.title`) against a locale tree. */
function resolve(tree: TranslationTree, key: string): string | undefined {
  let node: string | TranslationTree | undefined = tree;
  for (const segment of key.split('.')) {
    if (node === undefined || typeof node === 'string') return undefined;
    node = node[segment];
  }
  return typeof node === 'string' ? node : undefined;
}

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    name in params ? String(params[name]) : match,
  );
}

function isLocale(value: string | null): value is Locale {
  return value !== null && (LOCALES as readonly string[]).includes(value);
}

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  // Hydrate the persisted preference once on the client (falls back to <html lang>).
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (isLocale(stored)) {
      setLocaleState(stored);
      return;
    }
    const browserLang = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : '';
    if (isLocale(browserLang)) {
      setLocaleState(browserLang);
    }
  }, []);

  // Keep <html lang> and storage in sync whenever the locale changes.
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next);
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const value = resolve(translations[locale], key) ?? resolve(translations[DEFAULT_LOCALE], key);
      return value !== undefined ? interpolate(value, params) : key;
    },
    [locale],
  );

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>{children}</LanguageContext.Provider>
  );
};

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return ctx;
}

/** Convenience hook returning just the translator function. */
export function useTranslation(): LanguageContextValue['t'] {
  return useLanguage().t;
}