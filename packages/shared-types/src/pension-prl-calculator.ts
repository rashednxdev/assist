import {
  PENSION_BASIC_SALARY_BONUS_RATE,
  PENSION_DAYS_PER_MONTH,
  PENSION_LAMP_GRANT_MONTHS,
  PENSION_PRL_FULL_SPLIT_TOTAL_MONTHS,
  PENSION_PRL_STANDARD_MONTHS,
  PENSION_PRL_START_AGE_YEARS,
} from '@ibas/shared-constants';

export interface PrlCalculateInput {
  /** Date of birth (ISO) — the 59th birthday is the latest the PRL date can be. */
  dob: string;
  /** PRL start date (ISO), as entered by the admin. Defaults to the 59th birthday when omitted; capped there if later. */
  prl_date?: string;
  /** Total leave credited at retirement (the "average salary leave" months from calculatePension). */
  total_leave_months: number;
  /** Basic salary as of the retirement date (the "original basic"). */
  last_basic_salary: number;
  /**
   * Employee's chosen lump-sum months, only meaningful when total_leave_months is below the
   * fixed-split threshold (30) — at/above it, the split is fixed at 18 lump-sum + 12 PRL.
   */
  chosen_lump_sum_months?: number;
}

export interface PrlCalculateResult {
  /** ISO date — PRL start date actually used (the input, capped at the 59th birthday if later). */
  prl_start_date: string;
  /** True when the entered prl_date was after the 59th birthday and got capped back to it. */
  prl_date_capped: boolean;
  /**
   * ISO date — the final retirement date: prl_start_date + prl_salary_months (30-day months,
   * matching the rest of the pension calculators). Pension and gratuity are determined as of this date.
   */
  final_retirement_date: string;
  prl_salary_months: number;
  lump_sum_months: number;
  /** True when total_leave_months >= 30, so the 18+12 split is fixed rather than employee-chosen. */
  is_fixed_split: boolean;
  /** True if a July 1 (the annual increment date) falls within [prl_start_date, final_retirement_date]. */
  july_first_falls_within_prl: boolean;
  /** ISO date of the July 1 that falls within the PRL window, if any. */
  july_first_date: string | null;
  /** last_basic_salary, +5% when july_first_falls_within_prl — the basic salary on the final retirement date. */
  pension_basic_salary: number;
  /** Lump-sum grant amount, at the ORIGINAL (non-bumped) basic rate: last_basic_salary * lump_sum_months. */
  lump_sum_grant_amount: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addCalendarYears(iso: string, years: number): Date {
  const d = new Date(iso);
  d.setFullYear(d.getFullYear() + years);
  return d;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

/** Clamp to [min, max], treating NaN/undefined as 0. */
function clamp(value: number | undefined, min: number, max: number): number {
  const v = Number.isFinite(value) ? (value as number) : 0;
  return Math.min(max, Math.max(min, v));
}

export function calculatePrl(input: PrlCalculateInput): PrlCalculateResult {
  const total = Math.max(0, input.total_leave_months || 0);
  const isFixedSplit = total >= PENSION_PRL_FULL_SPLIT_TOTAL_MONTHS;

  // Default split: fill the standard 12-month PRL first, remainder (capped at 18) as lump sum —
  // this naturally produces the fixed 12+18 split once total reaches 30.
  const defaultPrlMonths = Math.min(PENSION_PRL_STANDARD_MONTHS, total);
  const defaultLumpMonths = Math.min(PENSION_LAMP_GRANT_MONTHS, Math.max(0, total - defaultPrlMonths));

  let prlSalaryMonths = defaultPrlMonths;
  let lumpSumMonths = defaultLumpMonths;

  // Below the fixed-split threshold, the employee may choose how to split their own total.
  if (!isFixedSplit && input.chosen_lump_sum_months !== undefined) {
    lumpSumMonths = clamp(input.chosen_lump_sum_months, 0, Math.min(PENSION_LAMP_GRANT_MONTHS, total));
    prlSalaryMonths = clamp(total - lumpSumMonths, 0, PENSION_PRL_STANDARD_MONTHS);
  }

  // The PRL date can never fall after the 59th birthday — cap it there if entered later.
  const fiftyNinthBirthday = addCalendarYears(input.dob, PENSION_PRL_START_AGE_YEARS);
  const requestedPrlDate = input.prl_date ? new Date(input.prl_date) : fiftyNinthBirthday;
  const prlDateCapped = requestedPrlDate.getTime() > fiftyNinthBirthday.getTime();
  const prlStart = prlDateCapped ? fiftyNinthBirthday : requestedPrlDate;

  const finalRetirementDate = addDays(prlStart, prlSalaryMonths * PENSION_DAYS_PER_MONTH);

  const candidateYears = [prlStart.getFullYear(), prlStart.getFullYear() + 1];
  let julyFirstDate: Date | null = null;
  for (const year of candidateYears) {
    const candidate = new Date(prlStart);
    candidate.setFullYear(year, 6, 1); // month is 0-indexed: 6 = July
    if (candidate >= prlStart && candidate <= finalRetirementDate) {
      julyFirstDate = candidate;
      break;
    }
  }

  const julyFirstFallsWithinPrl = julyFirstDate !== null;
  const pensionBasicSalary = julyFirstFallsWithinPrl
    ? round2(input.last_basic_salary * (1 + PENSION_BASIC_SALARY_BONUS_RATE))
    : round2(input.last_basic_salary);

  return {
    prl_start_date: toIso(prlStart),
    prl_date_capped: prlDateCapped,
    final_retirement_date: toIso(finalRetirementDate),
    prl_salary_months: prlSalaryMonths,
    lump_sum_months: lumpSumMonths,
    is_fixed_split: isFixedSplit,
    july_first_falls_within_prl: julyFirstFallsWithinPrl,
    july_first_date: julyFirstDate ? toIso(julyFirstDate) : null,
    pension_basic_salary: pensionBasicSalary,
    lump_sum_grant_amount: round2(input.last_basic_salary * lumpSumMonths),
  };
}
