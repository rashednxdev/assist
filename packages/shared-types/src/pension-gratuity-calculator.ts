import {
  PENSION_BAISHAKHI_ALLOWANCE_RATE,
  PENSION_DAYS_PER_YEAR,
  PENSION_FESTIVAL_ALLOWANCES_PER_YEAR,
  PENSION_GRATUITY_MIN_QUALIFYING_YEARS,
  PENSION_GRATUITY_MULTIPLIER_TABLE,
  PENSION_GRATUITY_RATE_TABLE,
  PENSION_LAMP_GRANT_MONTHS,
  PENSION_MEDICAL_ALLOWANCE_65_PLUS,
  PENSION_MEDICAL_ALLOWANCE_AGE_THRESHOLD,
  PENSION_MEDICAL_ALLOWANCE_UNDER_65,
  PENSION_MIN_MONTHLY_NET_PENSION,
} from '@ibas/shared-constants';
import { breakdownFromDays, daysBetweenInclusive, type PensionPeriodBreakdown } from './pension-calculator.js';

/**
 * Periods that don't count toward pensionable service: boy service (pre-18,
 * auto-calculated from DOB), leave-without-pay + unauthorized absence (both
 * captured via the enjoyed-leave list's without_pay category — see
 * PensionLeaveType seed data — and rolled up here as one total), unregularized
 * suspension (captured via the enjoyed-leave list's SUSPENSION-coded rows —
 * see isSuspensionLeaveCode — tracked separately since that type's
 * pay_category is 'average_salary', not 'without_pay'), and contractual/
 * part-time service (manual days, the one exclusion that isn't a "leave" at
 * all). All in days; omitted = 0.
 */
export interface PensionServiceExclusionInput {
  leave_without_pay_days?: number;
  suspension_days?: number;
  boy_service_days?: number;
  contractual_part_time_days?: number;
}

export interface QualifyingPensionServiceResult {
  raw_service_days: number;
  total_exclusion_days: number;
  qualifying_service_days: number;
  qualifying_service_years: number;
  breakdown: PensionPeriodBreakdown;
}

export function calculateQualifyingPensionService(
  joinDate: string,
  endDate: string,
  exclusions: PensionServiceExclusionInput,
): QualifyingPensionServiceResult {
  const rawServiceDays = daysBetweenInclusive(joinDate, endDate);
  const totalExclusionDays =
    (exclusions.leave_without_pay_days ?? 0) +
    (exclusions.suspension_days ?? 0) +
    (exclusions.boy_service_days ?? 0) +
    (exclusions.contractual_part_time_days ?? 0);
  const qualifyingServiceDays = Math.max(0, rawServiceDays - totalExclusionDays);

  return {
    raw_service_days: rawServiceDays,
    total_exclusion_days: totalExclusionDays,
    qualifying_service_days: qualifyingServiceDays,
    qualifying_service_years: Math.floor(qualifyingServiceDays / PENSION_DAYS_PER_YEAR),
    breakdown: breakdownFromDays(qualifyingServiceDays),
  };
}

/**
 * Boy service: the portion of [joinDate, endDate] spent under age 18, given a
 * date of birth. Returns 0 if dob/joinDate are missing or the person was
 * already 18+ at joining.
 */
export function calculateBoyServiceDays(dob: string, joinDate: string, endDate: string): number {
  if (!dob || !joinDate) return 0;
  const dobDate = new Date(dob);
  if (Number.isNaN(dobDate.getTime())) return 0;

  const eighteenth = new Date(dobDate);
  eighteenth.setFullYear(eighteenth.getFullYear() + 18);
  const dayBefore18 = new Date(eighteenth);
  dayBefore18.setDate(dayBefore18.getDate() - 1);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  const dayBefore18Iso = toIso(dayBefore18);

  const cutoff = endDate && endDate < dayBefore18Iso ? endDate : dayBefore18Iso;
  if (cutoff < joinDate) return 0;
  return daysBetweenInclusive(joinDate, cutoff);
}

export interface PensionGratuityInput {
  /** Qualifying (post-exclusions) years of pensionable service — see calculateQualifyingPensionService. */
  qualifying_years: number;
  last_basic_salary: number;
  /** Current age of the pensioner; omit to assume under the medical-allowance age threshold. */
  age_years?: number;
}

export interface PensionGratuityResult {
  qualifying_years: number;
  eligible: boolean;
  pension_rate_percent: number | null;
  gratuity_multiplier: number | null;
  half_pension_amount: number;
  gratuity_amount: number;
  medical_allowance: number;
  monthly_net_pension: number;
  festival_allowance_per_occasion: number;
  festival_allowances_per_year: number;
  baishakhi_allowance: number;
  leave_encashment_cap: number;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function lookupByBand<T extends { min_years: number }>(
  table: T[],
  qualifyingYears: number,
): T | null {
  return table.find((row) => qualifyingYears >= row.min_years) ?? null;
}

export function calculatePensionGratuity(input: PensionGratuityInput): PensionGratuityResult {
  const qualifyingYears = input.qualifying_years;
  const leaveEncashmentCap = round2(input.last_basic_salary * PENSION_LAMP_GRANT_MONTHS);

  const eligible = qualifyingYears >= PENSION_GRATUITY_MIN_QUALIFYING_YEARS;
  if (!eligible) {
    return {
      qualifying_years: qualifyingYears,
      eligible: false,
      pension_rate_percent: null,
      gratuity_multiplier: null,
      half_pension_amount: 0,
      gratuity_amount: 0,
      medical_allowance: 0,
      monthly_net_pension: 0,
      festival_allowance_per_occasion: 0,
      festival_allowances_per_year: PENSION_FESTIVAL_ALLOWANCES_PER_YEAR,
      baishakhi_allowance: 0,
      leave_encashment_cap: leaveEncashmentCap,
    };
  }

  const rateRow = lookupByBand(PENSION_GRATUITY_RATE_TABLE, qualifyingYears);
  const multiplierRow = lookupByBand(PENSION_GRATUITY_MULTIPLIER_TABLE, qualifyingYears);
  const ratePercent = rateRow?.rate_percent ?? 0;
  const multiplier = multiplierRow?.multiplier ?? 0;

  const halfPension = round2((input.last_basic_salary * ratePercent) / 100 / 2);
  const gratuityAmount = round2(halfPension * multiplier);
  const medicalAllowance =
    input.age_years !== undefined && input.age_years >= PENSION_MEDICAL_ALLOWANCE_AGE_THRESHOLD
      ? PENSION_MEDICAL_ALLOWANCE_65_PLUS
      : PENSION_MEDICAL_ALLOWANCE_UNDER_65;
  const monthlyNetPension = Math.max(PENSION_MIN_MONTHLY_NET_PENSION, round2(halfPension + medicalAllowance));
  const baishakhiAllowance = round2(monthlyNetPension * PENSION_BAISHAKHI_ALLOWANCE_RATE);

  return {
    qualifying_years: qualifyingYears,
    eligible: true,
    pension_rate_percent: ratePercent,
    gratuity_multiplier: multiplier,
    half_pension_amount: halfPension,
    gratuity_amount: gratuityAmount,
    medical_allowance: medicalAllowance,
    monthly_net_pension: monthlyNetPension,
    festival_allowance_per_occasion: monthlyNetPension,
    festival_allowances_per_year: PENSION_FESTIVAL_ALLOWANCES_PER_YEAR,
    baishakhi_allowance: baishakhiAllowance,
    leave_encashment_cap: leaveEncashmentCap,
  };
}
