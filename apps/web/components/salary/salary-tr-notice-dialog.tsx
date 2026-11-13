'use client';

import { useState } from 'react';
import { FileText, X } from 'lucide-react';
import { richHtmlIsEmpty, type SalaryTrNotice } from '@ibas/shared-types';
import type { SalaryLocale } from '@/lib/salary-i18n';
import { RichHtmlView } from '@/components/ui/rich-text-editor';
import { Button } from '@/components/ui/button';

const copy = {
  en: {
    title: 'Before the T.R. Form',
    continue: 'Continue',
    cancel: 'Cancel',
  },
  bn: {
    title: 'টি.আর. ফরমের আগে',
    continue: 'এগিয়ে যান',
    cancel: 'বাতিল',
  },
} as const;

function pick(locale: SalaryLocale, bn: string, en: string): string {
  const primary = (locale === 'bn' ? bn : en).trim();
  const fallback = (locale === 'bn' ? en : bn).trim();
  return primary || fallback;
}

export function trNoticeIsActive(notice: SalaryTrNotice | null, locale: SalaryLocale): boolean {
  if (!notice || notice.shown === false) return false;
  const body = pick(locale, notice.body_bn, notice.body_en);
  const confirm = pick(locale, notice.confirm_bn, notice.confirm_en);
  return !richHtmlIsEmpty(body) || confirm.length > 0;
}

export function SalaryTrNoticeDialog({
  locale,
  notice,
  onCancel,
  onContinue,
}: {
  locale: SalaryLocale;
  notice: SalaryTrNotice;
  onCancel: () => void;
  onContinue: () => void;
}) {
  const t = copy[locale];
  const body = pick(locale, notice.body_bn, notice.body_en);
  const confirm = pick(locale, notice.confirm_bn, notice.confirm_en);
  const [accepted, setAccepted] = useState(false);
  const blocked = confirm.length > 0 && !accepted;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4 print:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <div className="relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-emerald-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FileText className="h-5 w-5 text-emerald-700" />
            {t.title}
          </h2>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-slate-500 hover:bg-slate-100" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {richHtmlIsEmpty(body) ? null : <RichHtmlView html={body} />}
          {confirm ? (
            <label className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-3 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 shrink-0 accent-emerald-700"
                checked={accepted}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span className="font-medium leading-relaxed">{confirm}</span>
            </label>
          ) : null}
        </div>
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button type="button" disabled={blocked} className="bg-emerald-700 hover:bg-emerald-800" onClick={onContinue}>
            {t.continue}
          </Button>
        </div>
      </div>
    </div>
  );
}
