import {
  PENSION_BASIC_SALARY_BONUS_RATE,
  PENSION_DAYS_PER_MONTH,
  PENSION_DAYS_PER_YEAR,
  PENSION_LAMP_GRANT_MONTHS,
  PENSION_REST_ALLOWANCE_BASIC_MONTHS,
  PENSION_REST_CYCLE_YEARS,
  PENSION_REST_DAYS_PER_CYCLE,
  PENSION_REST_LEAVE_CODE,
  type PensionLeaveDeductionRule,
  type PensionLeavePayCategory,
} from '@ibas/shared-constants';

export interface PensionPeriodBreakdown {
  years: number;
  months: number;
  days: number;
  total_days: number;
}

export interface PensionLeaveTypeCalc {
  id: string;
  code: string;
  name_en: string;
  pay_category: PensionLeavePayCategory;
  deduction_rule: PensionLeaveDeductionRule;
  is_auto_entitlement?: boolean;
  entitlement_days_per_cycle?: number;
  entitlement_cycle_years?: number;
  allowance_basic_months?: number;
}

export interface PensionEnjoyedLeaveInput {
  leave_type_id: string;
  days: number;
}

export interface PensionCalculateInput {
  join_date: string;
  end_date: string;
  last_basic_salary: number;
  enjoyed_leaves: PensionEnjoyedLeaveInput[];
}

export interface PensionAutoLeaveResult {
  code: string;
  name_en: string;
  cycles: number;
  entitled_days: number;
  enjoyed_days: number;
  remaining_days: number;
  remaining: PensionPeriodBreakdown;
  allowance_per_cycle: number;
  total_allowance: number;
}

export interface PensionCalculateResult {
  service_period: PensionPeriodBreakdown;
  working_period: PensionPeriodBreakdown;
  leave_earning_period: PensionPeriodBreakdown;
  average_salary_leave_earned_days: number;
  half_average_leave_earned_days: number;
  average_salary_leave: PensionPeriodBreakdown;
  half_average_leave: PensionPeriodBreakdown;
  total_average_salary_leave: PensionPeriodBreakdown;
  without_pay_leave_days: number;
  without_pay_leave: PensionPeriodBreakdown;
  enjoyed_average_salary_days: number;
  enjoyed_half_average_days: number;
  enjoyed_without_pay_days: number;
  average_salary_leave_months: number;
  lamp_grant: number;
  lamp_grant_months_used: number;
  lamp_grant_uses_bonus_salary: boolean;
  auto_leaves: PensionAutoLeaveResult[];
}

export function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

export function breakdownFromDays(totalDays: number): PensionPeriodBreakdown {
  const d = Math.max(0, Math.round(totalDays * 100) / 100);
  const wholeDays = Math.floor(d);
  const years = Math.floor(wholeDays / PENSION_DAYS_PER_YEAR);
  const remAfterYears = wholeDays - years * PENSION_DAYS_PER_YEAR;
  const months = Math.floor(remAfterYears / PENSION_DAYS_PER_MONTH);
  const days = remAfterYears - months * PENSION_DAYS_PER_MONTH;
  return { years, months, days, total_days: d };
}

export function daysToMonths(totalDays: number): number {
  return totalDays / PENSION_DAYS_PER_MONTH;
}

export function formatPeriodLabel(p: PensionPeriodBreakdown): string {
  return `${p.years}y ${p.months}m ${p.days}d`;
}

function isAutoEntitlementType(type: PensionLeaveTypeCalc): boolean {
  return Boolean(type.is_auto_entitlement || type.code === PENSION_REST_LEAVE_CODE);
}

function autoEntitlementDefaults(type: PensionLeaveTypeCalc) {
  const isRest = type.code === PENSION_REST_LEAVE_CODE;
  return {
    entitlement_days_per_cycle:
      type.entitlement_days_per_cycle ?? (isRest ? PENSION_REST_DAYS_PER_CYCLE : 15),
    entitlement_cycle_years:
      type.entitlement_cycle_years ?? (isRest ? PENSION_REST_CYCLE_YEARS : 3),
    allowance_basic_months:
      type.allowance_basic_months ?? (isRest ? PENSION_REST_ALLOWANCE_BASIC_MONTHS : 1),
  };
}

export function ensureRestLeaveType(leaveTypes: PensionLeaveTypeCalc[]): PensionLeaveTypeCalc[] {
  const rest = leaveTypes.find((t) => t.code === PENSION_REST_LEAVE_CODE);
  if (rest) {
    const defaults = autoEntitlementDefaults(rest);
    return leaveTypes.map((t) =>
      t.code === PENSION_REST_LEAVE_CODE
        ? { ...t, is_auto_entitlement: true, pay_category: 'rest' as PensionLeavePayCategory, ...defaults }
        : t,
    );
  }
  return [
    ...leaveTypes,
    {
      id: '__auto_rest__',
      code: PENSION_REST_LEAVE_CODE,
      name_en: 'REST leave',
      pay_category: 'rest' as PensionLeavePayCategory,
      deduction_rule: 'none' as PensionLeaveDeductionRule,
      is_auto_entitlement: true,
      entitlement_days_per_cycle: PENSION_REST_DAYS_PER_CYCLE,
      entitlement_cycle_years: PENSION_REST_CYCLE_YEARS,
      allowance_basic_months: PENSION_REST_ALLOWANCE_BASIC_MONTHS,
    },
  ];
}

export function calculatePension(
  input: PensionCalculateInput,
  leaveTypes: PensionLeaveTypeCalc[],
): PensionCalculateResult {
  const normalizedTypes = ensureRestLeaveType(leaveTypes);
  const typeMap = new Map(normalizedTypes.map((t) => [t.id, t]));
  const serviceDays = daysBetweenInclusive(input.join_date, input.end_date);
  let leaveEarningDays = serviceDays;
  let workingDays = serviceDays;
  let enjoyedAvgDays = 0;
  let enjoyedHalfDays = 0;
  let enjoyedWithoutPayDays = 0;

  for (const row of input.enjoyed_leaves) {
    if (!row.days || row.days <= 0) continue;
    const type = typeMap.get(row.leave_type_id);
    if (!type || isAutoEntitlementType(type) || type.pay_category === 'rest') continue;

    if (type.deduction_rule === 'leave_earning_only') {
      leaveEarningDays -= row.days;
    } else if (type.deduction_rule === 'both') {
      leaveEarningDays -= row.days;
      workingDays -= row.days;
    }

    if (type.pay_category === 'average_salary') {
      enjoyedAvgDays += row.days;
    } else if (type.pay_category === 'half_average_salary') {
      enjoyedHalfDays += row.days;
    } else if (type.pay_category === 'without_pay') {
      enjoyedWithoutPayDays += row.days;
    }
  }

  leaveEarningDays = Math.max(0, leaveEarningDays);
  workingDays = Math.max(0, workingDays);

  const earnedAvgDays = leaveEarningDays / 11;
  const earnedHalfDays = leaveEarningDays / 12;
  const remainingAvgDays = Math.max(0, earnedAvgDays - enjoyedAvgDays);
  const remainingHalfDays = Math.max(0, earnedHalfDays - enjoyedHalfDays);
  const totalAvgEquivalentDays = remainingAvgDays + remainingHalfDays / 2;
  const averageSalaryLeaveMonths = daysToMonths(totalAvgEquivalentDays);

  const usesBonus = averageSalaryLeaveMonths >= PENSION_LAMP_GRANT_MONTHS;
  const lampMonthsUsed = usesBonus ? PENSION_LAMP_GRANT_MONTHS : averageSalaryLeaveMonths;
  const basicForLamp = usesBonus
    ? input.last_basic_salary * (1 + PENSION_BASIC_SALARY_BONUS_RATE)
    : input.last_basic_salary;
  const lampGrant = basicForLamp * lampMonthsUsed;

  const autoLeaves: PensionAutoLeaveResult[] = normalizedTypes
    .filter((t) => isAutoEntitlementType(t))
    .map((type) => {
      const { entitlement_days_per_cycle: daysPerCycle, entitlement_cycle_years: cycleYears, allowance_basic_months: allowanceMonths } =
        autoEntitlementDefaults(type);
      const serviceYears = serviceDays / PENSION_DAYS_PER_YEAR;
      const cycles = Math.floor(serviceYears / cycleYears);
      const entitledDays = cycles * daysPerCycle;
      // REST is service-based only — never reduced by enjoyed-leave rows.
      const enjoyedDays = 0;
      const remainingDays = entitledDays;
      const allowancePerCycle = input.last_basic_salary * allowanceMonths;
      return {
        code: type.code,
        name_en: type.name_en,
        cycles,
        entitled_days: entitledDays,
        enjoyed_days: enjoyedDays,
        remaining_days: remainingDays,
        remaining: breakdownFromDays(remainingDays),
        allowance_per_cycle: Math.round(allowancePerCycle * 100) / 100,
        total_allowance: Math.round(cycles * allowancePerCycle * 100) / 100,
      };
    });

  return {
    service_period: breakdownFromDays(serviceDays),
    working_period: breakdownFromDays(workingDays),
    leave_earning_period: breakdownFromDays(leaveEarningDays),
    average_salary_leave_earned_days: earnedAvgDays,
    half_average_leave_earned_days: earnedHalfDays,
    average_salary_leave: breakdownFromDays(remainingAvgDays),
    half_average_leave: breakdownFromDays(remainingHalfDays),
    total_average_salary_leave: breakdownFromDays(totalAvgEquivalentDays),
    without_pay_leave_days: enjoyedWithoutPayDays,
    without_pay_leave: breakdownFromDays(enjoyedWithoutPayDays),
    enjoyed_average_salary_days: enjoyedAvgDays,
    enjoyed_half_average_days: enjoyedHalfDays,
    enjoyed_without_pay_days: enjoyedWithoutPayDays,
    average_salary_leave_months: averageSalaryLeaveMonths,
    lamp_grant: Math.round(lampGrant * 100) / 100,
    lamp_grant_months_used: lampMonthsUsed,
    lamp_grant_uses_bonus_salary: usesBonus,
    auto_leaves: autoLeaves,
  };
}
