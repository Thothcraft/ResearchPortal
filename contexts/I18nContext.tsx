'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { translations, LOCALE_LABELS, RTL_LOCALES, type Locale, type TranslationKey } from '@/i18n/translations';

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  dir: 'ltr' | 'rtl';
  localeLabels: typeof LOCALE_LABELS;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const STORAGE_KEY = 'thoth-locale';

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && translations[saved]) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    localStorage.setItem(STORAGE_KEY, newLocale);
    document.documentElement.lang = newLocale;
    document.documentElement.dir = RTL_LOCALES.includes(newLocale) ? 'rtl' : 'ltr';
  }, []);

  const t = useCallback((key: TranslationKey): string => {
    return translations[locale]?.[key] ?? translations.en[key] ?? key;
  }, [locale]);

  const dir = RTL_LOCALES.includes(locale) ? 'rtl' : 'ltr';

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, dir, localeLabels: LOCALE_LABELS }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
