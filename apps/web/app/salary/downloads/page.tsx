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
import { SalaryLocaleToggle } from '@/components/salary/salary-locale-toggle';

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
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl bg-[#f4f9fd]/80 px-3 py-2 ring-1 ring-[#d7e8f8]">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[#0a2f5b]" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0a2f5b]">{label}</p>
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
    <div lang={locale} className="space-y-6 text-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/salary" className="inline-flex items-center gap-1.5 text-sm font-medium text-[#1566b8] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.backToSalary}
          </Link>
        </div>
        <SalaryLocaleToggle value={locale} onChange={changeLocale} />
      </div>

      <div className="space-y-4">
        <section className="rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-sm sm:p-5">
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

        <section className="rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-sm sm:p-5">
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
      </div>
    </div>
  );
}
