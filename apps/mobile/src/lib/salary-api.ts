import type { EmployeeGrossResult, PayGrade, Salary2026Result } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api';

export const STAGE_COLOR: Record<Salary2026Result['phase'], string> = {
  '2026-07-01': '#059669',
  '2027-01-01': '#d97706',
  '2027-07-01': '#7c3aed',
};

const BANGLA_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

/** Accepts ASCII and Bangla digits; anything else is stripped. */
export function parseAmountInput(raw: string): number {
  const normalized = String(raw)
    .split('')
    .map((ch) => BANGLA_DIGITS[ch] ?? ch)
    .join('')
    .replace(/,/g, '')
    .replace(/[^\d.]/g, '');
  const n = Number(normalized);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

export function allowancesTotal(gross: EmployeeGrossResult | null): number {
  if (!gross) return 0;
  return gross.monthly_lines.filter((row) => row.code !== 'basic').reduce((sum, row) => sum + row.amount, 0);
}

/** Stage-3 compares the 01-07-2026 and 01-07-2027 basics instead of the step table. */
export function stage3Basics(result: Salary2026Result): { from: number; to: number } {
  return {
    from: result.basic_on_2026_07 ?? result.matched_new_stage ?? result.new_pay,
    to: result.basic_on_2027_07 ?? result.new_pay,
  };
}

/** Usage counters only — results are always computed on the device. */
export function trackSalaryCalculate(grade: PayGrade, oldPay: number): void {
  void apiFetch('/salary/calculate-all-phases', {
    method: 'POST',
    body: JSON.stringify({ grade, old_pay: oldPay }),
  }).catch(() => {});
}
