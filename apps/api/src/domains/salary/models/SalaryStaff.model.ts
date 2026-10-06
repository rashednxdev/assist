import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { HousingStatus, HraArea } from '@ibas/shared-types';

/** One employee in a user's office staff arrear bill. Only the inputs are stored; arrears are recalculated. */
export interface ISalaryStaff extends Document {
  user_id: Types.ObjectId;
  name: string;
  post: string;
  nid: string;
  grade: number;
  old_pay: number;
  housing_status: HousingStatus;
  hra_area: HraArea;
  excess_rr: boolean;
  excess_puja: boolean;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ISalaryStaff>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    post: { type: String, required: true, trim: true },
    nid: { type: String, default: '' },
    grade: { type: Number, required: true, min: 1, max: 20 },
    old_pay: { type: Number, required: true, min: 1 },
    housing_status: { type: String, enum: ['hra_eligible', 'govt_accommodation'], required: true },
    hra_area: { type: String, enum: ['dhaka', 'major_city', 'other'], required: true },
    excess_rr: { type: Boolean, default: false },
    excess_puja: { type: Boolean, default: false },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const SalaryStaff = mongoose.model<ISalaryStaff>('SalaryStaff', schema, 'salary_staff');
