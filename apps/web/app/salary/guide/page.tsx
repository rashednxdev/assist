'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { richHtmlIsEmpty, type SalaryCalcGuide } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { SalarySubpage } from '@/components/salary/salary-subpage';
import { useSalaryUser } from '@/components/salary/salary-auth-gate';
import { isPlatformAdmin } from '@/lib/capabilities';
import { RichHtmlView } from '@/components/ui/rich-text-editor';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { SalaryLocale } from '@/lib/salary-i18n';

const copy = {
  en: {
    kicker: 'Salary help',
    title: 'Instructions',
    subtitle: 'How the salary and arrears bill is calculated.',
    empty: 'Instructions have not been added yet.',
    edit: 'Edit instructions',
    loadError: 'Could not load the instructions.',
  },
  bn: {
    kicker: 'বেতন সহায়িকা',
    title: 'নির্দেশনা',
    subtitle: 'বেতন ও বকেয়া বিল কীভাবে হিসাব হয়।',
    empty: 'নির্দেশনা এখনো যোগ করা হয়নি।',
    edit: 'নির্দেশনা সম্পাদনা',
    loadError: 'নির্দেশনা লোড করা যায়নি।',
  },
} as const;

function GuideBody({ locale, isAdmin }: { locale: SalaryLocale; isAdmin: boolean }) {
  const t = copy[locale];
  const [guide, setGuide] = useState<SalaryCalcGuide | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: SalaryCalcGuide }>('/salary/help/guide')
      .then((res) => setGuide(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : t.loadError))
      .finally(() => setLoading(false));
  }, [t.loadError]);

  const html = locale === 'bn' ? guide?.body_bn || guide?.body_en || '' : guide?.body_en || guide?.body_bn || '';

  return (
    <article className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm">
      <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 via-white to-teal-50 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">{t.kicker}</p>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-extrabold text-slate-900 sm:text-2xl">{t.title}</h1>
            <p className="mt-1 text-sm text-slate-600">{t.subtitle}</p>
          </div>
          {isAdmin ? (
            <Button asChild size="sm" className="bg-emerald-700 hover:bg-emerald-800">
              <Link href="/admin/salary-help?tab=guide">{t.edit}</Link>
            </Button>
          ) : null}
        </div>
      </div>
      <div className="px-5 py-5">
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        ) : error ? (
          <Alert variant="error">{error}</Alert>
        ) : richHtmlIsEmpty(html) ? (
          <p className="text-sm text-slate-500">{t.empty}</p>
        ) : (
          <RichHtmlView html={html} />
        )}
      </div>
    </article>
  );
}

export default function SalaryGuidePage() {
  const me = useSalaryUser();
  return <SalarySubpage>{(locale) => <GuideBody locale={locale} isAdmin={isPlatformAdmin(me)} />}</SalarySubpage>;
}
