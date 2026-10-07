import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** An office a user prepares a staff arrear bill for, besides their own registered office. */
export interface ISalaryStaffOffice extends Document {
  user_id: Types.ObjectId;
  name: string;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ISalaryStaffOffice>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    created_at: { type: Date, default: Date.now },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const SalaryStaffOffice = mongoose.model<ISalaryStaffOffice>('SalaryStaffOffice', schema, 'salary_staff_offices');
