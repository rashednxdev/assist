'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';
import { readSalaryLocale, writeSalaryLocale } from '@/lib/salary-locale';
import { SalaryLocaleToggle } from '@/components/salary/salary-locale-toggle';

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
    <div lang={locale} className="space-y-6 text-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/salary"
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#d7e4ee] bg-white px-4 py-2 text-xs font-semibold text-[#0a2f5b] hover:border-[#1566b8]"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.backToSalary}
        </Link>
        <SalaryLocaleToggle value={locale} onChange={changeLocale} />
      </div>
      {children(locale)}
    </div>
  );
}
