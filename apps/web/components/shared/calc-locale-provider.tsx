'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import type { AppLocale } from '@/i18n/config';
import en from '@/messages/en.json';
import bn from '@/messages/bn.json';

const CalcLocaleContext = createContext<{
  locale: AppLocale;
  setLocale: (locale: AppLocale) => void;
} | null>(null);

const MESSAGES = { en, bn } as const;

/** Local EN/BN only for Pension & Joining calculators — does not affect the rest of the app. */
export function CalcLocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocale] = useState<AppLocale>('en');
  const value = useMemo(() => ({ locale, setLocale }), [locale]);

  return (
    <CalcLocaleContext.Provider value={value}>
      <NextIntlClientProvider locale={locale} messages={MESSAGES[locale]}>
        {children}
      </NextIntlClientProvider>
    </CalcLocaleContext.Provider>
  );
}

export function useCalcLocale() {
  const ctx = useContext(CalcLocaleContext);
  if (!ctx) throw new Error('useCalcLocale must be used within CalcLocaleProvider');
  return ctx;
}
