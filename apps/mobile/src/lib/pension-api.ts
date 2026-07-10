import { apiFetch } from './api';
import type { PensionLeavePayCategory, PensionLeaveDeductionRule } from '@ibas/shared-constants';
import type { PensionCalculateResult } from '@ibas/shared-types';

export interface PensionLeaveTypeRow {
  id: string;
  code: string;
  name_en: string;
  name_bn?: string;
  pay_category: PensionLeavePayCategory;
  deduction_rule: PensionLeaveDeductionRule;
  is_auto_entitlement?: boolean;
}

export async function fetchPensionLeaveTypes() {
  const res = await apiFetch<{ data: PensionLeaveTypeRow[] }>('/pension/leave-types');
  return res.data;
}

export async function calculatePensionApi(body: {
  join_date: string;
  end_date: string;
  last_basic_salary: number;
  enjoyed_leaves: Array<{ leave_type_id: string; days: number }>;
}) {
  const res = await apiFetch<{ data: PensionCalculateResult }>('/pension/calculate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return res.data;
}
