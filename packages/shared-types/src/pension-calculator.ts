import {
  PENSION_BASIC_SALARY_BONUS_RATE,
  PENSION_DAYS_PER_MONTH,
  PENSION_DAYS_PER_YEAR,
  PENSION_LAMP_GRANT_MONTHS,
  PENSION_MATERNITY_DAYS_BEFORE_RULE,
  PENSION_MATERNITY_DAYS_FROM_RULE,
  PENSION_MATERNITY_LEAVE_CODE,
  PENSION_MATERNITY_RULE_CHANGE_DATE,
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

export interface PensionRestSummary {
  cycles: number;
  entitled_days: number;
  enjoyed_days: number;
  auto_applied: boolean;
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
  enjoyed_regular_working_days: number;
  regular_working_period: PensionPeriodBreakdown;
  average_salary_leave_months: number;
  lamp_grant: number;
  lamp_grant_months_used: number;
  lamp_grant_uses_bonus_salary: boolean;
  rest_leave: PensionRestSummary | null;
}

export function daysBetweenInclusive(startIso: string, endIso: string): number {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000)) + 1;
}

/** Round half up: .5 or above goes to the next whole number. */
export function roundHalfUp(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);
}

export function breakdownFromDays(totalDays: number): PensionPeriodBreakdown {
  const d = Math.max(0, roundHalfUp(totalDays));
  const years = Math.floor(d / PENSION_DAYS_PER_YEAR);
  const remAfterYears = d - years * PENSION_DAYS_PER_YEAR;
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

/** Maternity: start before 18 May 2021 → 120 days; on/after → 180 days. */
export function maternityDaysFromStartDate(startIso: string): number {
  if (!startIso) return 0;
  const start = new Date(startIso);
  const cutoff = new Date(PENSION_MATERNITY_RULE_CHANGE_DATE);
  if (Number.isNaN(start.getTime())) return 0;
  return start < cutoff ? PENSION_MATERNITY_DAYS_BEFORE_RULE : PENSION_MATERNITY_DAYS_FROM_RULE;
}

export function isMaternityLeaveCode(code: string | undefined): boolean {
  return code === PENSION_MATERNITY_LEAVE_CODE;
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
        ? { ...t, is_auto_entitlement: true, pay_category: 'average_salary', ...defaults }
        : t,
    );
  }
  return [
    ...leaveTypes,
    {
      id: '__auto_rest__',
      code: PENSION_REST_LEAVE_CODE,
      name_en: 'REST leave',
      pay_category: 'average_salary' as PensionLeavePayCategory,
      deduction_rule: 'none' as PensionLeaveDeductionRule,
      is_auto_entitlement: true,
      entitlement_days_per_cycle: PENSION_REST_DAYS_PER_CYCLE,
      entitlement_cycle_years: PENSION_REST_CYCLE_YEARS,
      allowance_basic_months: PENSION_REST_ALLOWANCE_BASIC_MONTHS,
    },
  ];
}

function restEntitledDays(serviceDays: number, type: PensionLeaveTypeCalc): { cycles: number; days: number } {
  const { entitlement_days_per_cycle: daysPerCycle, entitlement_cycle_years: cycleYears } =
    autoEntitlementDefaults(type);
  const serviceYears = serviceDays / PENSION_DAYS_PER_YEAR;
  const cycles = Math.floor(serviceYears / cycleYears);
  return { cycles, days: cycles * daysPerCycle };
}

function buildEffectiveEnjoyedLeaves(
  input: PensionEnjoyedLeaveInput[],
  restType: PensionLeaveTypeCalc | undefined,
  serviceDays: number,
): { rows: PensionEnjoyedLeaveInput[]; restAutoApplied: boolean; restEnjoyedDays: number } {
  if (!restType) {
    return { rows: input, restAutoApplied: false, restEnjoyedDays: 0 };
  }

  const manualRestDays = input
    .filter((r) => r.leave_type_id === restType.id && r.days > 0)
    .reduce((sum, r) => sum + r.days, 0);

  if (manualRestDays > 0) {
    return { rows: input, restAutoApplied: false, restEnjoyedDays: manualRestDays };
  }

  const { days: entitledDays } = restEntitledDays(serviceDays, restType);
  if (entitledDays <= 0) {
    return { rows: input, restAutoApplied: false, restEnjoyedDays: 0 };
  }

  return {
    rows: [...input, { leave_type_id: restType.id, days: entitledDays }],
    restAutoApplied: true,
    restEnjoyedDays: entitledDays,
  };
}

function applyEnjoyedLeave(
  type: PensionLeaveTypeCalc,
  days: number,
  state: {
    leaveEarningDays: number;
    workingDays: number;
    enjoyedAvgDays: number;
    enjoyedHalfDays: number;
    enjoyedWithoutPayDays: number;
    enjoyedRegularWorkingDays: number;
  },
) {
  if (type.deduction_rule === 'leave_earning_only') {
    state.leaveEarningDays -= days;
  } else if (type.deduction_rule === 'both') {
    state.leaveEarningDays -= days;
    state.workingDays -= days;
  }

  if (type.pay_category === 'average_salary') {
    state.enjoyedAvgDays += days;
  } else if (type.pay_category === 'half_average_salary') {
    state.enjoyedHalfDays += days;
  } else if (type.pay_category === 'without_pay') {
    state.enjoyedWithoutPayDays += days;
  } else if (type.pay_category === 'regular_working_period') {
    state.enjoyedRegularWorkingDays += days;
  }
}

export function previewRestLeaveDeduction(
  joinDate: string,
  endDate: string,
  enjoyedLeaves: PensionEnjoyedLeaveInput[],
  leaveTypes: PensionLeaveTypeCalc[],
): { days: number; auto_applied: boolean; cycles: number } {
  if (!joinDate || !endDate) {
    return { days: 0, auto_applied: false, cycles: 0 };
  }
  const normalizedTypes = ensureRestLeaveType(leaveTypes);
  const restType = normalizedTypes.find((t) => t.code === PENSION_REST_LEAVE_CODE);
  if (!restType) {
    return { days: 0, auto_applied: false, cycles: 0 };
  }
  const serviceDays = daysBetweenInclusive(joinDate, endDate);
  const { restAutoApplied, restEnjoyedDays } = buildEffectiveEnjoyedLeaves(
    enjoyedLeaves,
    restType,
    serviceDays,
  );
  const { cycles } = restEntitledDays(serviceDays, restType);
  return { days: restEnjoyedDays, auto_applied: restAutoApplied, cycles };
}

export function calculatePension(
  input: PensionCalculateInput,
  leaveTypes: PensionLeaveTypeCalc[],
): PensionCalculateResult {
  const normalizedTypes = ensureRestLeaveType(leaveTypes);
  const typeMap = new Map(normalizedTypes.map((t) => [t.id, t]));
  const restType = normalizedTypes.find((t) => t.code === PENSION_REST_LEAVE_CODE);
  const serviceDays = daysBetweenInclusive(input.join_date, input.end_date);

  const { rows: effectiveEnjoyed, restAutoApplied, restEnjoyedDays } = buildEffectiveEnjoyedLeaves(
    input.enjoyed_leaves,
    restType,
    serviceDays,
  );

  const state = {
    leaveEarningDays: serviceDays,
    workingDays: serviceDays,
    enjoyedAvgDays: 0,
    enjoyedHalfDays: 0,
    enjoyedWithoutPayDays: 0,
    enjoyedRegularWorkingDays: 0,
  };

  for (const row of effectiveEnjoyed) {
    if (!row.days || row.days <= 0) continue;
    const type = typeMap.get(row.leave_type_id);
    if (!type) continue;
    applyEnjoyedLeave(type, row.days, state);
  }

  state.leaveEarningDays = Math.max(0, state.leaveEarningDays);
  state.workingDays = Math.max(0, state.workingDays);

  const earnedAvgDays = roundHalfUp(state.leaveEarningDays / 11);
  const earnedHalfDays = roundHalfUp(state.leaveEarningDays / 12);
  const remainingAvgDays = Math.max(0, earnedAvgDays - state.enjoyedAvgDays);
  const remainingHalfDays = Math.max(0, earnedHalfDays - state.enjoyedHalfDays);
  const halfAsAverageDays = roundHalfUp(remainingHalfDays / 2);
  const totalAvgEquivalentDays = remainingAvgDays + halfAsAverageDays;
  const averageSalaryLeaveMonths = daysToMonths(totalAvgEquivalentDays);

  const usesBonus = averageSalaryLeaveMonths >= PENSION_LAMP_GRANT_MONTHS;
  const lampMonthsUsed = usesBonus ? PENSION_LAMP_GRANT_MONTHS : averageSalaryLeaveMonths;
  const basicForLamp = usesBonus
    ? input.last_basic_salary * (1 + PENSION_BASIC_SALARY_BONUS_RATE)
    : input.last_basic_salary;
  const lampGrant = basicForLamp * lampMonthsUsed;

  let restLeave: PensionRestSummary | null = null;
  if (restType) {
    const { cycles, days: entitledDays } = restEntitledDays(serviceDays, restType);
    const { allowance_basic_months: allowanceMonths } = autoEntitlementDefaults(restType);
    const allowancePerCycle = input.last_basic_salary * allowanceMonths;
    const enjoyedDays = restEnjoyedDays;
    if (entitledDays > 0 || enjoyedDays > 0) {
      restLeave = {
        cycles,
        entitled_days: entitledDays,
        enjoyed_days: enjoyedDays,
        auto_applied: restAutoApplied,
        allowance_per_cycle: Math.round(allowancePerCycle * 100) / 100,
        total_allowance: Math.round(cycles * allowancePerCycle * 100) / 100,
      };
    }
  }

  return {
    service_period: breakdownFromDays(serviceDays),
    working_period: breakdownFromDays(state.workingDays),
    leave_earning_period: breakdownFromDays(state.leaveEarningDays),
    average_salary_leave_earned_days: earnedAvgDays,
    half_average_leave_earned_days: earnedHalfDays,
    average_salary_leave: breakdownFromDays(remainingAvgDays),
    half_average_leave: breakdownFromDays(remainingHalfDays),
    total_average_salary_leave: breakdownFromDays(totalAvgEquivalentDays),
    without_pay_leave_days: state.enjoyedWithoutPayDays,
    without_pay_leave: breakdownFromDays(state.enjoyedWithoutPayDays),
    enjoyed_average_salary_days: state.enjoyedAvgDays,
    enjoyed_half_average_days: state.enjoyedHalfDays,
    enjoyed_without_pay_days: state.enjoyedWithoutPayDays,
    enjoyed_regular_working_days: state.enjoyedRegularWorkingDays,
    regular_working_period: breakdownFromDays(state.enjoyedRegularWorkingDays),
    average_salary_leave_months: averageSalaryLeaveMonths,
    lamp_grant: Math.round(lampGrant * 100) / 100,
    lamp_grant_months_used: lampMonthsUsed,
    lamp_grant_uses_bonus_salary: usesBonus,
    rest_leave: restLeave,
  };
}
