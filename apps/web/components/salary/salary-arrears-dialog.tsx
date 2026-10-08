'use client';

import { useState } from 'react';
import { ReceiptText, X } from 'lucide-react';
import {
  NPS_2015,
  PAY_GRADES,
  effectiveSubstantiveGrade,
  formatTaka,
  salaryTrFormNo,
  substantiveGradeOptions,
  type HousingStatus,
  type HraArea,
  type PayGrade,
  type SubstantiveGrade,
} from '@ibas/shared-types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { HRA_AREAS, hraAreaText, localNum, salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';

export interface ArrearsInputs {
  grade: PayGrade | null;
  oldPay: number;
  housingStatus: HousingStatus;
  hraArea: HraArea;
  substantiveGrade: SubstantiveGrade | null;
}

const selectClass =
  'flex h-10 w-full rounded-md border border-indigo-300 bg-white px-3 text-sm font-medium focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:bg-slate-100';

/** Confirms grade, basic, housing and substantive grade before the arrears bill is shown. */
export function SalaryArrearsDialog({
  locale,
  initial,
  calcNote,
  onCancel,
  onConfirm,
}: {
  locale: SalaryLocale;
  initial: ArrearsInputs;
  /** Free / counted calculation status shown above the buttons. */
  calcNote?: string;
  onCancel: () => void;
  /** Resolves to an error message to keep the dialog open, or null when done. */
  onConfirm: (inputs: ArrearsInputs) => Promise<string | null>;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const [v, setV] = useState<ArrearsInputs>(initial);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const stepNo = v.grade && v.oldPay > 0 ? NPS_2015[v.grade].indexOf(v.oldPay) + 1 : 0;
  const effectiveSubstantive = v.grade ? effectiveSubstantiveGrade(v.grade, v.substantiveGrade) : null;
  const formNo = effectiveSubstantive ? salaryTrFormNo(effectiveSubstantive) : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.grade) return setError(t.gradeRequired);
    if (stepNo <= 0) return setError(t.basicRequired);
    setSubmitting(true);
    setError('');
    const message = await onConfirm({ ...v, substantiveGrade: effectiveSubstantive });
    setSubmitting(false);
    if (message) setError(message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <form onSubmit={submit} className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ReceiptText className="h-5 w-5 text-indigo-700" />
              {t.arrDialogTitle}
            </h2>
            <p className="mt-2 rounded-md border border-yellow-400 bg-gradient-to-r from-yellow-300 via-yellow-100 to-white px-2.5 py-1.5 text-sm font-semibold text-amber-950 shadow-sm">
              {t.arrDialogHint}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="arr-grade">{t.grade}</Label>
              <select
                id="arr-grade"
                className={selectClass}
                value={v.grade ?? ''}
                onChange={(e) => {
                  const g = e.target.value === '' ? null : (Number(e.target.value) as PayGrade);
                  setError('');
                  setV((prev) => ({
                    ...prev,
                    grade: g,
                    oldPay: g && NPS_2015[g].includes(prev.oldPay) ? prev.oldPay : 0,
                    substantiveGrade: g,
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
              <Label htmlFor="arr-basic">{t.basicJune}</Label>
              <select
                id="arr-basic"
                className={`${selectClass} tabular-nums`}
                disabled={!v.grade}
                value={v.oldPay > 0 ? v.oldPay : ''}
                onChange={(e) => {
                  setError('');
                  setV((prev) => ({ ...prev, oldPay: Number(e.target.value) || 0 }));
                }}
              >
                <option value="">{v.grade ? t.basicPlaceholder : t.gradeFirst}</option>
                {v.grade
                  ? NPS_2015[v.grade].map((amount, i) => (
                      <option key={amount} value={amount}>
                        {`${num(formatTaka(amount))} — ${t.stepOption(num(i + 1))}`}
                      </option>
                    ))
                  : null}
              </select>
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-800">{t.housing}</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="arr-housing"
                className="mt-1"
                checked={v.housingStatus === 'hra_eligible'}
                onChange={() => setV((prev) => ({ ...prev, housingStatus: 'hra_eligible' }))}
              />
              <span>{t.hraEligible}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="arr-housing"
                className="mt-1"
                checked={v.housingStatus === 'govt_accommodation'}
                onChange={() => setV((prev) => ({ ...prev, housingStatus: 'govt_accommodation' }))}
              />
              <span>{t.govtAccommodation}</span>
            </label>
          </fieldset>

          {v.housingStatus === 'hra_eligible' ? (
            <div className="space-y-1.5">
              <Label htmlFor="arr-hra-area">{t.hraArea}</Label>
              <select
                id="arr-hra-area"
                className={selectClass}
                value={v.hraArea}
                onChange={(e) => setV((prev) => ({ ...prev, hraArea: e.target.value as HraArea }))}
              >
                {HRA_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {hraAreaText(locale, a)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label htmlFor="arr-substantive">{t.substantive}</Label>
            {v.grade ? (
              <>
                <select
                  id="arr-substantive"
                  className={selectClass}
                  value={effectiveSubstantiveGrade(v.grade, v.substantiveGrade)}
                  onChange={(e) =>
                    setV((prev) => ({ ...prev, substantiveGrade: Number(e.target.value) as SubstantiveGrade }))
                  }
                >
                  {substantiveGradeOptions(v.grade).map((g) => (
                    <option key={g} value={g}>
                      {g === v.grade ? t.substantiveSame(num(g)) : `${t.grade} ${num(g)}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">{t.substantiveHint}</p>
              </>
            ) : (
              <p id="arr-substantive" className="rounded-md border border-border bg-slate-50 px-3 py-2 text-sm font-medium">
                {t.gradeFirst}
              </p>
            )}
          </div>

          {formNo ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-950">
              <span className="font-semibold">{t.billFormLabel}:</span> {t.trFormName(num(formNo))}
              <p className="mt-0.5 text-xs text-indigo-900/80">{t.billFormRule}</p>
            </div>
          ) : null}

          {calcNote ? (
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
              {calcNote}
            </p>
          ) : null}

          {error ? <Alert variant="error">{error}</Alert> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
            {t.cancel}
          </Button>
          <Button type="submit" className="gap-2 bg-indigo-700 hover:bg-indigo-800" disabled={submitting}>
            <ReceiptText className="h-4 w-4" />
            {submitting ? t.calcChecking : t.calcArrears}
          </Button>
        </div>
      </form>
    </div>
  );
}
