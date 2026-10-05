import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { SALARY_BILL_KINDS, type SalaryBillKind } from '@ibas/shared-types';

export interface ISalaryBillUsage extends Document {
  user_id: Types.ObjectId;
  kind: SalaryBillKind;
  grade: number;
  old_pay: number;
  months: string[];
  net_total: number;
  created_at: Date;
}

const schema = new Schema<ISalaryBillUsage>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: SALARY_BILL_KINDS, required: true },
    grade: { type: Number, required: true },
    old_pay: { type: Number, required: true },
    months: { type: [String], default: [] },
    net_total: { type: Number, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ user_id: 1, created_at: -1 });

export const SalaryBillUsage = mongoose.model<ISalaryBillUsage>('SalaryBillUsage', schema, 'salary_bill_usage');
