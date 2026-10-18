'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, MessageCircle, X } from 'lucide-react';
import {
  NPS_2015,
  NO_EXCEPTIONAL_ISSUES,
  PAY_GRADES,
  asksSubstantiveGrade,
  formatTaka,
  isIsoDate,
  substantiveGradeOptions,
  type PayGrade,
  type SalaryExceptionalIssues,
  type SalaryPayChange,
  type SubstantiveGrade,
} from '@ibas/shared-types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { localNum, salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';

export type ExceptionalDraft = {
  enabled: boolean;
  incrementExempt: boolean;
  payChangeOn: boolean;
  payChangeDate: string;
  payChangeGrade: PayGrade | null;
  payChangeOldPay: number;
  /** Substantive grade after promotion — separate from the main-form (pre) substantive. */
  payChangeSubstantive: SubstantiveGrade | null;
  customStartOn: boolean;
  arrearStartDate: string;
};

export const EMPTY_EXCEPTIONAL_DRAFT: ExceptionalDraft = {
  enabled: false,
  incrementExempt: false,
  payChangeOn: false,
  payChangeDate: '',
  payChangeGrade: null,
  payChangeOldPay: 0,
  payChangeSubstantive: null,
  customStartOn: false,
  arrearStartDate: '',
};

export function exceptionalFromIssues(issues: SalaryExceptionalIssues | null | undefined): ExceptionalDraft {
  const ex = issues ?? NO_EXCEPTIONAL_ISSUES;
  const pay = ex.pay_change ?? null;
  const start = ex.arrear_start_date ?? '';
  const hasAny = Boolean(ex.increment_exempt || pay || (start && start > '2026-07-01'));
  const promoGrade = pay ? (pay.grade as PayGrade) : null;
  const postSub =
    pay && promoGrade != null && pay.substantive_grade != null
      ? (pay.substantive_grade as SubstantiveGrade)
      : promoGrade != null && !asksSubstantiveGrade(promoGrade)
        ? promoGrade
        : null;
  return {
    enabled: hasAny,
    incrementExempt: Boolean(ex.increment_exempt),
    payChangeOn: Boolean(pay),
    payChangeDate: pay?.effective_date ?? '',
    payChangeGrade: promoGrade,
    payChangeOldPay: pay?.old_pay ?? 0,
    payChangeSubstantive: postSub,
    customStartOn: Boolean(start && start > '2026-07-01'),
    arrearStartDate: start && start > '2026-07-01' ? start : '',
  };
}

function resolvePostSubstantive(
  grade: PayGrade | null,
  chosen: SubstantiveGrade | null,
): SubstantiveGrade | null {
  if (grade == null) return null;
  if (!asksSubstantiveGrade(grade)) return grade;
  return chosen != null && substantiveGradeOptions(grade).includes(chosen) ? chosen : null;
}

export function exceptionalToIssues(draft: ExceptionalDraft): SalaryExceptionalIssues | null {
  if (!draft.enabled) return null;
  const postSub = resolvePostSubstantive(draft.payChangeGrade, draft.payChangeSubstantive);
  const pay_change: SalaryPayChange | null =
    draft.payChangeOn && draft.payChangeGrade && draft.payChangeOldPay > 0 && isIsoDate(draft.payChangeDate) && postSub != null
      ? {
          effective_date: draft.payChangeDate,
          grade: draft.payChangeGrade,
          old_pay: draft.payChangeOldPay,
          substantive_grade: postSub,
        }
      : null;
  const arrear_start_date =
    draft.customStartOn && isIsoDate(draft.arrearStartDate) && draft.arrearStartDate > '2026-07-01'
      ? draft.arrearStartDate
      : null;
  if (!draft.incrementExempt && !pay_change && !arrear_start_date) return null;
  return {
    increment_exempt: draft.incrementExempt,
    pay_change,
    arrear_start_date,
  };
}

/** Staff DTO shape: always present, never undefined optionals. */
export function exceptionalToStaffDto(draft: ExceptionalDraft): {
  increment_exempt: boolean;
  pay_change: {
    effective_date: string;
    grade: number;
    old_pay: number;
    substantive_grade: number | null;
  } | null;
  arrear_start_date: string | null;
} {
  const issues = exceptionalToIssues(draft);
  return {
    increment_exempt: Boolean(issues?.increment_exempt),
    pay_change: issues?.pay_change
      ? {
          effective_date: issues.pay_change.effective_date,
          grade: issues.pay_change.grade,
          old_pay: issues.pay_change.old_pay,
          substantive_grade: issues.pay_change.substantive_grade ?? null,
        }
      : null,
    arrear_start_date: issues?.arrear_start_date ?? null,
  };
}

const gradeSelectClass =
  'flex h-11 w-full rounded-md border-2 border-emerald-400 bg-emerald-50/60 px-3 text-base font-semibold ring-2 ring-emerald-200 focus:border-emerald-500 focus:outline-none focus:ring-emerald-300 disabled:cursor-not-allowed disabled:border-border disabled:bg-slate-100 disabled:ring-0';

function validateDraft(draft: ExceptionalDraft, t: ReturnType<typeof salaryCopy>): string | null {
  if (!draft.enabled) return null;
  if (!draft.incrementExempt && !draft.payChangeOn && !draft.customStartOn) {
    return t.exNeedOne;
  }
  if (draft.payChangeOn) {
    if (!isIsoDate(draft.payChangeDate)) return t.exPayDateRequired;
    if (draft.payChangeDate < '2026-07-01') return t.exPayDateMin;
    if (!draft.payChangeGrade) return t.gradeRequired;
    if (!NPS_2015[draft.payChangeGrade].includes(draft.payChangeOldPay)) {
      return t.basicRequired;
    }
    if (resolvePostSubstantive(draft.payChangeGrade, draft.payChangeSubstantive) == null) {
      return t.exPaySubstantiveRequired;
    }
  }
  if (draft.customStartOn) {
    if (!isIsoDate(draft.arrearStartDate)) return t.exStartRequired;
    if (draft.arrearStartDate <= '2026-07-01') return t.exStartMin;
  }
  return null;
}

/** Checkbox that opens a dialog for increment exemption, pay change, and custom arrears start. */
export function SalaryExceptionalIssuesField({
  locale,
  value,
  onChange,
}: {
  locale: SalaryLocale;
  value: ExceptionalDraft;
  onChange: (next: ExceptionalDraft) => void;
}) {
  const t = salaryCopy(locale);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const num = (v: string | number) => localNum(locale, v);
  const summary = exceptionalToIssues(value);
  const postOptions =
    draft.payChangeGrade != null ? substantiveGradeOptions(draft.payChangeGrade) : [];
  const asksPostSubstantive =
    draft.payChangeGrade != null && asksSubstantiveGrade(draft.payChangeGrade);
  const postValue = resolvePostSubstantive(draft.payChangeGrade, draft.payChangeSubstantive);

  useEffect(() => {
    if (open) {
      setDraft(value.enabled ? value : { ...EMPTY_EXCEPTIONAL_DRAFT, enabled: true });
      setError('');
    }
  }, [open, value]);

  function apply() {
    const next = { ...draft, enabled: true };
    const message = validateDraft(next, t);
    if (message) {
      setError(message);
      return;
    }
    onChange(next);
    setOpen(false);
  }

  function clearAll() {
    onChange(EMPTY_EXCEPTIONAL_DRAFT);
    setOpen(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex justify-end rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-900">
          <span className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-700" />
            {t.exLabel}
          </span>
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={value.enabled}
            onChange={(e) => {
              if (e.target.checked) setOpen(true);
              else onChange(EMPTY_EXCEPTIONAL_DRAFT);
            }}
          />
        </label>
      </div>
      {value.enabled && summary ? (
        <div className="space-y-1 text-right text-xs text-slate-700">
          {summary.increment_exempt ? <p>· {t.exIncrementSummary}</p> : null}
          {summary.pay_change ? (
            <p>
              ·{' '}
              {t.exPaySummary(
                num(summary.pay_change.effective_date.split('-').reverse().join('-')),
                num(summary.pay_change.grade),
                num(formatTaka(summary.pay_change.old_pay)),
              )}
              {summary.pay_change.substantive_grade != null &&
              summary.pay_change.substantive_grade !== summary.pay_change.grade
                ? ` · ${t.exPaySubstantiveShort} ${num(summary.pay_change.substantive_grade)}`
                : null}
            </p>
          ) : null}
          {summary.arrear_start_date ? (
            <p>· {t.exStartSummary(num(summary.arrear_start_date.split('-').reverse().join('-')))}</p>
          ) : null}
          <button type="button" className="font-medium text-primary hover:underline" onClick={() => setOpen(true)}>
            {t.exEdit}
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
          <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface shadow-xl">
            <div className="border-b border-border p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700" />
                  {t.exDialogTitle}
                </h2>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={`https://wa.me/${t.exDialogPhone.replace(/\D/g, '').replace(/^0/, '880')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-full bg-[#25D366] px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-[#1ebe57]"
                    aria-label={t.whatsapp}
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    {t.whatsapp}
                  </a>
                  <a
                    href={`tel:${t.exDialogPhone}`}
                    className="text-base font-bold tabular-nums text-slate-900 hover:text-primary"
                  >
                    {t.exDialogPhone}
                  </a>
                  <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label={t.cancel}>
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <p className="mt-2 text-xs font-semibold text-[#b71c1c]">{t.exDialogHint}</p>
            </div>

            <div className="space-y-4 p-5">
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-slate-50/80 p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={draft.incrementExempt}
                  onChange={(e) => setDraft((d) => ({ ...d, incrementExempt: e.target.checked }))}
                />
                <span>
                  <span className="font-semibold">{t.exIncrementTitle}</span>
                  <span className="mt-0.5 block text-xs text-muted">{t.exIncrementHint}</span>
                </span>
              </label>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={draft.payChangeOn}
                    onChange={(e) => setDraft((d) => ({ ...d, payChangeOn: e.target.checked }))}
                  />
                  <span>
                    <span className="font-semibold">{t.exPayTitle}</span>
                    <span className="mt-0.5 block text-xs text-muted">{t.exPayHint}</span>
                  </span>
                </label>
                {draft.payChangeOn ? (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-1">
                      <Label htmlFor="ex-pay-date" className="text-sm font-bold">
                        {t.exPayDate}
                      </Label>
                      <input
                        id="ex-pay-date"
                        type="date"
                        min="2026-07-01"
                        className="flex h-11 w-full rounded-md border-2 border-emerald-400 bg-emerald-50/60 px-3 text-base font-semibold ring-2 ring-emerald-200 focus:border-emerald-500 focus:outline-none focus:ring-emerald-300"
                        value={draft.payChangeDate}
                        onChange={(e) => setDraft((d) => ({ ...d, payChangeDate: e.target.value }))}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                      <div className="space-y-1.5">
                        <Label htmlFor="ex-pay-grade" className="text-sm font-bold">
                          {t.grade}
                        </Label>
                        <select
                          id="ex-pay-grade"
                          className={gradeSelectClass}
                          value={draft.payChangeGrade ?? ''}
                          onChange={(e) => {
                            const g = e.target.value ? (Number(e.target.value) as PayGrade) : null;
                            setDraft((d) => ({
                              ...d,
                              payChangeGrade: g,
                              payChangeOldPay: 0,
                              payChangeSubstantive:
                                g != null && !asksSubstantiveGrade(g)
                                  ? g
                                  : d.payChangeSubstantive != null &&
                                      g != null &&
                                      substantiveGradeOptions(g).includes(d.payChangeSubstantive)
                                    ? d.payChangeSubstantive
                                    : null,
                            }));
                          }}
                        >
                          <option value="">{t.gradePlaceholder}</option>
                          {PAY_GRADES.map((g) => (
                            <option key={g} value={g}>
                              {`${t.grade} ${num(g)}`}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ex-pay-basic" className="text-sm font-bold">
                          {t.exPayBasic}
                        </Label>
                        <select
                          id="ex-pay-basic"
                          disabled={!draft.payChangeGrade}
                          className={`${gradeSelectClass} tabular-nums`}
                          value={draft.payChangeOldPay > 0 ? draft.payChangeOldPay : ''}
                          onChange={(e) => setDraft((d) => ({ ...d, payChangeOldPay: Number(e.target.value) || 0 }))}
                        >
                          <option value="">{draft.payChangeGrade ? t.basicPlaceholder : t.gradeFirst}</option>
                          {draft.payChangeGrade
                            ? NPS_2015[draft.payChangeGrade].map((amount, i) => (
                                <option key={amount} value={amount}>
                                  {`${num(formatTaka(amount))} — ${t.stepOption(num(i + 1))}${i === 0 ? ` (${t.initialBasic})` : ''}`}
                                </option>
                              ))
                            : null}
                        </select>
                      </div>
                    </div>
                    {draft.payChangeGrade && !asksPostSubstantive ? (
                      <p className="text-xs text-muted">
                        {t.exPaySubstantiveAuto(num(draft.payChangeGrade))}
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <Label htmlFor="ex-pay-substantive" className="text-sm font-bold">
                          {t.exPaySubstantive}
                        </Label>
                        <select
                          id="ex-pay-substantive"
                          className="flex h-11 w-full rounded-md border-2 border-[#b71c1c] bg-red-50 px-3 text-base font-semibold text-[#b71c1c] ring-2 ring-red-200 focus:border-[#b71c1c] focus:outline-none focus:ring-red-300 disabled:cursor-not-allowed disabled:border-border disabled:bg-slate-100 disabled:text-muted disabled:ring-0"
                          value={postValue ?? ''}
                          disabled={!draft.payChangeGrade}
                          onChange={(e) =>
                            setDraft((d) => ({
                              ...d,
                              payChangeSubstantive: e.target.value
                                ? (Number(e.target.value) as SubstantiveGrade)
                                : null,
                            }))
                          }
                        >
                          <option value="" disabled>
                            {draft.payChangeGrade ? t.substantivePlaceholder : t.gradeFirst}
                          </option>
                          {postOptions.map((g) => (
                            <option key={g} value={g}>
                              {g === draft.payChangeGrade
                                ? t.substantiveSame(num(g))
                                : `${t.grade} ${num(g)}`}
                            </option>
                          ))}
                        </select>
                        <p className="text-xs text-muted">{t.exPaySubstantiveHint}</p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              <div className="space-y-2 rounded-lg border border-border p-3">
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={draft.customStartOn}
                    onChange={(e) => setDraft((d) => ({ ...d, customStartOn: e.target.checked }))}
                  />
                  <span>
                    <span className="font-semibold">{t.exStartTitle}</span>
                    <span className="mt-0.5 block text-xs text-muted">{t.exStartHint}</span>
                  </span>
                </label>
                {draft.customStartOn ? (
                  <div className="space-y-1 pl-6">
                    <Label htmlFor="ex-start-date" className="text-xs">
                      {t.exStartDate}
                    </Label>
                    <input
                      id="ex-start-date"
                      type="date"
                      min="2026-07-02"
                      className="flex h-10 w-full max-w-xs rounded-md border border-border bg-white px-3 text-sm"
                      value={draft.arrearStartDate}
                      onChange={(e) => setDraft((d) => ({ ...d, arrearStartDate: e.target.value }))}
                    />
                  </div>
                ) : null}
              </div>

              {error ? <Alert variant="error">{error}</Alert> : null}

              <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-3">
                <Button type="button" variant="outline" onClick={clearAll}>
                  {t.exClear}
                </Button>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  {t.cancel}
                </Button>
                <Button type="button" onClick={apply}>
                  {t.exApply}
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
