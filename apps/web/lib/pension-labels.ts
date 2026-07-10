import type { PensionLeaveDeductionRule, PensionLeavePayCategory } from '@ibas/shared-constants';
import type { AppLocale } from '@/i18n/config';

type TranslateFn = (key: string) => string;

export function payCategoryLabel(t: TranslateFn, category: PensionLeavePayCategory): string {
  return t(`payCategory.${category}`);
}

export function deductionRuleLabel(t: TranslateFn, rule: PensionLeaveDeductionRule): string {
  return t(`deductionRule.${rule}`);
}

export function leaveTypeDisplayName(
  locale: AppLocale,
  type: { name_en: string; name_bn?: string },
): string {
  if (locale === 'bn' && type.name_bn?.trim()) return type.name_bn.trim();
  return type.name_en;
}

/** @deprecated Prefer payCategoryLabel with useTranslations('pension') */
export const PAY_CATEGORY_LABELS: Record<PensionLeavePayCategory, string> = {
  average_salary: 'On average salary',
  half_average_salary: 'On half-average salary',
  without_pay: 'Without pay',
  regular_working_period: 'Regular working period',
};

/** @deprecated Prefer deductionRuleLabel with useTranslations('pension') */
export const DEDUCTION_RULE_LABELS: Record<PensionLeaveDeductionRule, string> = {
  leave_earning_only: 'Deduct from leave-earning period only (counts as working)',
  both: 'Deduct from leave-earning and working period',
  none: 'Not deducted from either period',
};
