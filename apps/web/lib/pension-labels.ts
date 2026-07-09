import type { PensionLeaveDeductionRule, PensionLeavePayCategory } from '@ibas/shared-constants';

export const PAY_CATEGORY_LABELS: Record<PensionLeavePayCategory, string> = {
  average_salary: 'On average salary',
  half_average_salary: 'On half-average salary',
  without_pay: 'Without pay',
  regular_working_period: 'Regular working period',
};

export const DEDUCTION_RULE_LABELS: Record<PensionLeaveDeductionRule, string> = {
  leave_earning_only: 'Deduct from leave-earning period only (counts as working)',
  both: 'Deduct from leave-earning and working period',
  none: 'Not deducted from either period',
};
