'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, Building2, History, Mail, Phone, UserRound } from 'lucide-react';
import { salaryCanSeeDownloads, type SalaryBillAccessRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';
import { readSalaryLocale, writeSalaryLocale } from '@/lib/salary-locale';
import { Alert } from '@/components/ui/alert';
import { useSalaryUser } from '@/components/salary/salary-auth-gate';
import { useSalaryOffice } from '@/components/salary/salary-office-gate';
import { SalaryPrintReportView } from '@/components/salary/salary-print-report';

function ProfileFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof UserRound;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl bg-emerald-50/80 px-3 py-2 ring-1 ring-emerald-100">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-800">{label}</p>
        <p className="truncate text-sm font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

export default function SalaryMyDownloadsPage() {
  const me = useSalaryUser();
  const { office } = useSalaryOffice();
  const [locale, setLocale] = useState<SalaryLocale>('bn');
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [loadError, setLoadError] = useState(false);
  const t = salaryCopy(locale);

  useEffect(() => {
    setLocale(readSalaryLocale());
  }, []);

  useEffect(() => {
    apiFetch<{ data: SalaryBillAccessRecord }>('/salary/access')
      .then((res) => setAllowed(salaryCanSeeDownloads(res.data)))
      .catch(() => setLoadError(true));
  }, []);

  function changeLocale(next: SalaryLocale) {
    setLocale(next);
    writeSalaryLocale(next);
  }

  const name = (locale === 'bn' && me?.full_name_bn?.trim() ? me.full_name_bn.trim() : me?.full_name_en?.trim()) || '';
  const phone = me?.phone?.trim() || '';
  const email = me?.email?.trim() || '';
  const officeLabel = office?.label?.trim() || '';

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
        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
          <h1 className="flex items-center gap-2 text-lg font-bold text-[#0b3d2e]">
            <History className="h-5 w-5" />
            {t.myDownloadsTitle}
          </h1>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {name ? <ProfileFact icon={UserRound} label={t.userYour} value={name} /> : null}
            {phone ? <ProfileFact icon={Phone} label={t.profileContact} value={phone} /> : null}
            {email ? <ProfileFact icon={Mail} label={t.profileEmail} value={email} /> : null}
            {officeLabel ? <ProfileFact icon={Building2} label={t.officeYour} value={officeLabel} /> : null}
          </div>
        </section>

        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm sm:p-5">
          <p className="text-sm text-slate-600">{t.myDownloadsIntro}</p>
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
        </section>
      </main>
    </div>
  );
}
