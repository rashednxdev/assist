import mongoose, { Schema, type Document } from 'mongoose';
import type { PensionLeaveDeductionRule, PensionLeavePayCategory } from '@ibas/shared-constants';

export interface IPensionLeaveType extends Document {
  code: string;
  name_en: string;
  name_bn?: string;
  description_en?: string;
  pay_category: PensionLeavePayCategory;
  deduction_rule: PensionLeaveDeductionRule;
  sort_order: number;
  is_active: boolean;
  is_auto_entitlement?: boolean;
  entitlement_days_per_cycle?: number;
  entitlement_cycle_years?: number;
  allowance_basic_months?: number;
}

const schema = new Schema<IPensionLeaveType>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    name_en: { type: String, required: true },
    name_bn: { type: String },
    description_en: { type: String },
    pay_category: { type: String, required: true, enum: ['average_salary', 'half_average_salary', 'without_pay', 'rest'] },
    deduction_rule: { type: String, required: true, enum: ['leave_earning_only', 'both', 'none'] },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    is_auto_entitlement: { type: Boolean, default: false },
    entitlement_days_per_cycle: { type: Number },
    entitlement_cycle_years: { type: Number },
    allowance_basic_months: { type: Number },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const PensionLeaveType = mongoose.model<IPensionLeaveType>(
  'PensionLeaveType',
  schema,
  'pension_leave_types',
);
