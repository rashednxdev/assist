'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, History } from 'lucide-react';
import { salaryCanSeeDownloads, type SalaryBillAccessRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';
import { Alert } from '@/components/ui/alert';
import { SalaryPrintReportView } from '@/components/salary/salary-print-report';

export default function SalaryMyDownloadsPage() {
  const [locale, setLocale] = useState<SalaryLocale>('bn');
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);
  const t = salaryCopy(locale);

  useEffect(() => {
    apiFetch<{ data: SalaryBillAccessRecord }>('/salary/access')
      .then((res) => setAllowed(salaryCanSeeDownloads(res.data)))
      .catch(() => setLoadError(true));
  }, []);

  return (
    <div lang={locale} className="flex min-h-screen flex-col bg-[#f4f7f5] text-slate-900">
      <header className="border-b border-emerald-900/10 bg-[#0b3d2e] text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/salary" className="min-w-0">
            <div className="text-sm font-bold tracking-wide">ProAssist</div>
            <div className="text-[11px] text-emerald-100/80">{t.brandSub}</div>
          </Link>
          <div className="flex items-center gap-2">
            <div className="inline-flex items-center rounded-lg border border-white/30 bg-white/5 p-0.5 text-sm" role="group" aria-label="Language">
              {(['en', 'bn'] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setLocale(loc)}
                  aria-pressed={locale === loc}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    locale === loc ? 'bg-white text-[#0b3d2e]' : 'text-white/80 hover:text-white'
                  }`}
                >
                  {loc === 'en' ? 'EN' : 'বাং'}
                </button>
              ))}
            </div>
            <Link
              href="/salary"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/30 bg-white/5 px-2.5 text-sm font-medium text-white hover:bg-white/15"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t.backToSalary}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-4 px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-2xl border border-emerald-200 bg-white p-5 shadow-sm">
          <h1 className="flex items-center gap-2 text-lg font-bold text-[#0b3d2e]">
            <History className="h-5 w-5" />
            {t.myDownloadsTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-600">{t.myDownloadsIntro}</p>
          <div className="mt-4">
            {loadError ? (
              <Alert variant="error">{t.reportLoadError}</Alert>
            ) : allowed === null ? (
              <p className="text-sm text-muted">…</p>
            ) : allowed ? (
              <SalaryPrintReportView path="/salary/my-downloads" locale={locale} />
            ) : (
              <Alert variant="warning">{t.reportNotApproved}</Alert>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
