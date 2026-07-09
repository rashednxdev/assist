import { PensionLeaveType } from '../../src/domains/pension/models/PensionLeaveType.model.js';
import {
  PENSION_REST_ALLOWANCE_BASIC_MONTHS,
  PENSION_REST_CYCLE_YEARS,
  PENSION_REST_DAYS_PER_CYCLE,
} from '@ibas/shared-constants';

const DEFAULT_LEAVE_TYPES = [
  {
    code: 'EARNED_LEAVE',
    name_en: 'Earned leave (privilege leave)',
    name_bn: 'অর্জিত ছুটি',
    description_en: 'Enjoyed on average salary; not deducted from leave-earning or working period.',
    pay_category: 'average_salary' as const,
    deduction_rule: 'none' as const,
    sort_order: 10,
  },
  {
    code: 'HALF_PAY_LEAVE',
    name_en: 'Half-average salary leave',
    name_bn: 'অর্ধ গড় বেতন ছুটি',
    description_en: 'Enjoyed on half-average salary; not deducted from service.',
    pay_category: 'half_average_salary' as const,
    deduction_rule: 'none' as const,
    sort_order: 15,
  },
  {
    code: 'REGULAR_WORKING_PERIOD',
    name_en: 'Regular working period',
    name_bn: 'নিয়মিত কর্মসময়',
    description_en:
      'Deducted from leave-earning period only; counts as regular working period (not average or half-average leave account).',
    pay_category: 'regular_working_period' as const,
    deduction_rule: 'leave_earning_only' as const,
    sort_order: 20,
  },
  {
    code: 'REST',
    name_en: 'REST leave',
    name_bn: 'বিশ্রাম ছুটি',
    description_en:
      '15 days every 3 years of service; allowance equal to one month basic salary per cycle. Auto-deducted from leave account by default; can also be added in enjoyed leave list.',
    pay_category: 'average_salary' as const,
    deduction_rule: 'none' as const,
    is_auto_entitlement: true,
    entitlement_days_per_cycle: PENSION_REST_DAYS_PER_CYCLE,
    entitlement_cycle_years: PENSION_REST_CYCLE_YEARS,
    allowance_basic_months: PENSION_REST_ALLOWANCE_BASIC_MONTHS,
    sort_order: 25,
  },
  {
    code: 'MATERNITY',
    name_en: 'Maternity leave',
    name_bn: 'প্রসূতি ছুটি',
    description_en:
      'Enter start date only. Before 18 May 2021: 120 days; on/after 18 May 2021: 180 days. Deducted from leave-earning period only; counts as working period.',
    pay_category: 'half_average_salary' as const,
    deduction_rule: 'leave_earning_only' as const,
    sort_order: 30,
  },
  {
    code: 'STUDY_LEAVE',
    name_en: 'Study leave',
    name_bn: 'অধ্যয়ন ছুটি',
    description_en: 'Deducted from leave-earning period only; counts as working period.',
    pay_category: 'average_salary' as const,
    deduction_rule: 'leave_earning_only' as const,
    sort_order: 40,
  },
  {
    code: 'LEAVE_WITHOUT_PAY',
    name_en: 'Leave without pay',
    name_bn: 'বেতনহীন ছুটি',
    description_en: 'Without-pay account; deducted from both leave-earning and working period.',
    pay_category: 'without_pay' as const,
    deduction_rule: 'both' as const,
    sort_order: 50,
  },
  {
    code: 'SUSPENSION',
    name_en: 'Suspension period',
    name_bn: 'সাসপেনশন',
    description_en: 'Deducted from both leave-earning and working period.',
    pay_category: 'average_salary' as const,
    deduction_rule: 'both' as const,
    sort_order: 60,
  },
  {
    code: 'EXTRAORDINARY',
    name_en: 'Extraordinary leave',
    name_bn: 'অসাধারণ ছুটি',
    description_en: 'Deducted from both leave-earning and working period.',
    pay_category: 'half_average_salary' as const,
    deduction_rule: 'both' as const,
    sort_order: 70,
  },
];

export async function seedPensionData() {
  for (const row of DEFAULT_LEAVE_TYPES) {
    await PensionLeaveType.updateOne(
      { code: row.code },
      { $set: { ...row, is_active: true } },
      { upsert: true },
    );
  }
  console.log(`Seeded ${DEFAULT_LEAVE_TYPES.length} pension leave types`);
}
