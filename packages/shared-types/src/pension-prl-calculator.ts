import {
  PENSION_BASIC_SALARY_BONUS_RATE,
  PENSION_DAYS_PER_MONTH,
  PENSION_LAMP_GRANT_MONTHS,
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
   * True when the employee is already at the last step of their pay grade, so no further annual
   * increment is due — the July-1 5% bump is skipped even if July 1 falls within the PRL period.
   */
  is_last_grade_step?: boolean;
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
  /** True if a July 1 (the annual increment date) falls within [prl_start_date, final_retirement_date]. */
  july_first_falls_within_prl: boolean;
  /** ISO date of the July 1 that falls within the PRL window, if any. */
  july_first_date: string | null;
  /** True when the July-1 5% bump was actually applied (falls within PRL window AND not the last grade step). */
  july_first_bonus_applied: boolean;
  /** last_basic_salary, +5% when july_first_bonus_applied — the basic salary on the final retirement date. */
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

export function calculatePrl(input: PrlCalculateInput): PrlCalculateResult {
  const total = Math.max(0, input.total_leave_months || 0);

  // Fill the standard 12-month PRL first, remainder (capped at 18) as lump sum. Below 12 months
  // total, PRL takes all of it and there's no lump sum; at/above 30, this naturally settles at
  // the fixed 12 PRL + 18 lump-sum split. Not a choice — the employee has no say in the split.
  const prlSalaryMonths = Math.min(PENSION_PRL_STANDARD_MONTHS, total);
  const lumpSumMonths = Math.min(PENSION_LAMP_GRANT_MONTHS, Math.max(0, total - prlSalaryMonths));

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
  const julyFirstBonusApplied = julyFirstFallsWithinPrl && !input.is_last_grade_step;
  const pensionBasicSalary = julyFirstBonusApplied
    ? round2(input.last_basic_salary * (1 + PENSION_BASIC_SALARY_BONUS_RATE))
    : round2(input.last_basic_salary);

  return {
    prl_start_date: toIso(prlStart),
    prl_date_capped: prlDateCapped,
    final_retirement_date: toIso(finalRetirementDate),
    prl_salary_months: prlSalaryMonths,
    lump_sum_months: lumpSumMonths,
    july_first_falls_within_prl: julyFirstFallsWithinPrl,
    july_first_date: julyFirstDate ? toIso(julyFirstDate) : null,
    july_first_bonus_applied: julyFirstBonusApplied,
    pension_basic_salary: pensionBasicSalary,
    lump_sum_grant_amount: round2(input.last_basic_salary * lumpSumMonths),
  };
}
