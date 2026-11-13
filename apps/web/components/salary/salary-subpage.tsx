'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';
import { readSalaryLocale, writeSalaryLocale } from '@/lib/salary-locale';

export function SalarySubpage({
  children,
}: {
  children: (locale: SalaryLocale) => React.ReactNode;
}) {
  const [locale, setLocale] = useState<SalaryLocale>('bn');

  useEffect(() => {
    setLocale(readSalaryLocale());
  }, []);

  function changeLocale(next: SalaryLocale) {
    setLocale(next);
    writeSalaryLocale(next);
  }

  const t = salaryCopy(locale);

  return (
    <div lang={locale} className="flex min-h-screen flex-col bg-[#f4f7f5] text-slate-900">
      <header className="border-b border-emerald-900/10 bg-[#0b3d2e] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/salary" className="inline-flex min-w-0 items-center gap-2">
            <ArrowLeft className="h-4 w-4 shrink-0" />
            <span className="min-w-0">
              <span className="block text-sm font-bold tracking-wide">ProAssist</span>
              <span className="block truncate text-[11px] text-emerald-100/80">{t.brandSub}</span>
            </span>
          </Link>
          <div className="inline-flex items-center rounded-lg border border-white/30 bg-white/5 p-0.5 text-sm" role="group" aria-label="Language">
            {(['en', 'bn'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => changeLocale(loc)}
                aria-pressed={locale === loc}
                className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                  locale === loc ? 'bg-white text-[#0b3d2e]' : 'text-white/80 hover:text-white'
                }`}
              >
                {loc === 'en' ? 'EN' : 'বাং'}
              </button>
            ))}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children(locale)}</main>
    </div>
  );
}
