'use client';

import { SALARY_INCREMENT_CUTOFF_DATE, isIsoDate } from '@ibas/shared-types';
import { Label } from '@/components/ui/label';
import { salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';

const ARREAR_START_DATE = '2026-07-01';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Joining date of service, asked for the initial basic of Grade 7–20. Before 02-01-2026 the
 * 01-07-2026 increment applies; on or after it does not; after 01-07-2026 arrears start from it.
 */
export function SalaryJoiningDateField({
  locale,
  id,
  value,
  onChange,
}: {
  locale: SalaryLocale;
  id: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const t = salaryCopy(locale);
  const valid = isIsoDate(value);
  const note = !valid
    ? t.joiningDateHint
    : value < SALARY_INCREMENT_CUTOFF_DATE
      ? t.joiningBeforeNote
      : value > ARREAR_START_DATE
        ? t.joiningAfterJulyNote
        : t.joiningNoIncrementNote;

  return (
    <div className="space-y-1.5 rounded-lg border border-amber-300 bg-amber-50/70 px-3 py-2.5">
      <Label htmlFor={id} className="text-sm font-semibold text-amber-950">
        {t.joiningDate}
      </Label>
      <input
        id={id}
        type="date"
        max={todayIso()}
        className="flex h-10 w-full rounded-md border border-amber-400 bg-white px-3 text-sm font-medium focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 sm:max-w-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p
        className={`text-xs ${
          !valid ? 'text-muted' : value < SALARY_INCREMENT_CUTOFF_DATE ? 'font-medium text-emerald-700' : 'font-medium text-amber-800'
        }`}
      >
        {note}
      </p>
    </div>
  );
}
