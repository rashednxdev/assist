'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpenText, ChevronRight, CircleHelp, Loader2, Phone, Pin } from 'lucide-react';
import type { SalaryHelpFeed } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import type { SalaryLocale } from '@/lib/salary-i18n';
import { Button } from '@/components/ui/button';

const PREVIEW_LIMIT = 6;
const SALARY_CONTACT_NO = '01842196643';

const copy = {
  en: {
    help: 'Salary Help',
    instructions: 'Instructions',
    hint: 'How the salary and arrears bill is calculated.',
    title: 'Questions',
    empty: 'No published questions yet.',
    all: 'All questions',
    ask: 'Ask a question',
    manage: 'Edit questions',
    editGuide: 'Edit instructions',
    pinned: 'Pinned',
    loadError: 'Could not load questions.',
    retry: 'Try again',
  },
  bn: {
    help: 'বেতন সহায়িকা',
    instructions: 'নির্দেশনা',
    hint: 'বেতন ও বকেয়া বিল কীভাবে হিসাব হয়।',
    title: 'প্রশ্ন',
    empty: 'এখনো কোনো প্রশ্ন প্রকাশিত হয়নি।',
    all: 'সব প্রশ্ন',
    ask: 'প্রশ্ন করুন',
    manage: 'প্রশ্ন সম্পাদনা',
    editGuide: 'নির্দেশনা সম্পাদনা',
    pinned: 'গুরুত্বপূর্ণ',
    loadError: 'প্রশ্ন লোড করা যায়নি।',
    retry: 'আবার চেষ্টা',
  },
} as const;

function pick(locale: SalaryLocale, bn: string, en: string): string {
  const primary = (locale === 'bn' ? bn : en).trim();
  const fallback = (locale === 'bn' ? en : bn).trim();
  return primary || fallback;
}

export function SalaryHelpRail({ locale, isAdmin }: { locale: SalaryLocale; isAdmin: boolean }) {
  const t = copy[locale];
  const [feed, setFeed] = useState<SalaryHelpFeed | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiFetch<{ data: SalaryHelpFeed }>('/salary/help')
      .then((res) => {
        setFeed(res.data);
        setLoadError('');
      })
      .catch(() => setLoadError(t.loadError))
      .finally(() => setLoading(false));
  }, [t.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const faqs = feed?.faqs ?? [];
  const preview = faqs.slice(0, PREVIEW_LIMIT);

  return (
    <div className="space-y-3">
      <a
        href={`tel:${SALARY_CONTACT_NO}`}
        className="flex items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-[1.225rem] font-bold leading-snug text-emerald-950 shadow-sm hover:bg-emerald-50"
      >
        <Phone className="h-[1.4rem] w-[1.4rem] shrink-0 text-emerald-700" aria-hidden />
        <span>Contact No: {SALARY_CONTACT_NO}</span>
      </a>
      <div className="grid grid-cols-2 gap-2 xl:hidden">
        <Link
          href="/salary/questions"
          className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-2 py-2.5 text-center text-sm font-bold leading-tight text-emerald-900 shadow-sm hover:bg-emerald-50"
        >
          <CircleHelp className="h-4 w-4 shrink-0" />
          {t.help}
        </Link>
        <Link
          href="/salary/guide"
          className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-teal-200 bg-white px-2 py-2.5 text-center text-sm font-bold leading-tight text-teal-900 shadow-sm hover:bg-teal-50"
        >
          <BookOpenText className="h-4 w-4 shrink-0" />
          {t.instructions}
        </Link>
      </div>

      <section className="hidden overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm xl:block">
        <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50 px-4 py-3">
          <h2 className="inline-flex items-center gap-1.5 text-base font-extrabold text-slate-900">
            <CircleHelp className="h-4 w-4 text-emerald-700" aria-hidden />
            {t.help}
          </h2>
          <p className="mt-0.5 text-xs text-slate-600">{t.title}</p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 px-4 py-6 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : loadError ? (
          <p className="px-4 py-4 text-sm text-rose-700">
            {loadError}{' '}
            <button type="button" className="font-semibold underline" onClick={load}>
              {t.retry}
            </button>
          </p>
        ) : preview.length === 0 ? (
          <p className="px-4 py-4 text-sm text-slate-500">{t.empty}</p>
        ) : (
          <ul>
            {preview.map((item) => (
              <li key={item.id} className="border-b border-emerald-50 last:border-b-0">
                <Link
                  href={`/salary/questions#salary-faq-${item.id}`}
                  className="flex items-start gap-2 px-4 py-2.5 text-left hover:bg-emerald-50"
                >
                  <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 text-sm font-semibold text-slate-900">
                      {pick(locale, item.question_bn, item.question_en)}
                    </span>
                    {item.pinned ? (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                        <Pin className="h-3 w-3" />
                        {t.pinned}
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 border-t border-emerald-100 bg-slate-50/80 p-3">
          <Button asChild variant="outline" size="sm" className="flex-1 border-emerald-200 bg-white">
            <Link href="/salary/questions">{t.all}</Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="flex-1 border-emerald-200 bg-white">
            <Link href="/salary/questions#salary-ask">{t.ask}</Link>
          </Button>
        </div>
        {isAdmin ? (
          <div className="px-3 pb-3">
            <Button asChild variant="ghost" size="sm" className="w-full">
              <Link href="/admin/salary-help">{t.manage}</Link>
            </Button>
          </div>
        ) : null}
      </section>

      <section className="hidden rounded-2xl border border-teal-200 bg-white p-4 shadow-sm xl:block">
        <Link href="/salary/guide" className="block hover:text-teal-950">
          <h2 className="inline-flex items-center gap-1.5 text-base font-extrabold text-slate-900">
            <BookOpenText className="h-4 w-4 text-teal-700" aria-hidden />
            {t.instructions}
          </h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">{t.hint}</p>
        </Link>
        {isAdmin ? (
          <Link href="/admin/salary-help?tab=guide" className="mt-2 inline-block text-xs font-semibold text-teal-800 hover:underline">
            {t.editGuide}
          </Link>
        ) : null}
      </section>
    </div>
  );
}
