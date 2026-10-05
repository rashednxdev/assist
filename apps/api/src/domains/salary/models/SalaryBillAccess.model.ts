import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISalaryBillAccess extends Document {
  user_id: Types.ObjectId;
  status: 'pending' | 'approved' | 'rejected';
  /** Total arrears bills the admin allows; a bill can be used while bills_used < bill_limit. */
  bill_limit: number;
  bills_used: number;
  request_pending: boolean;
  requested_bulks: number | null;
  requested_bills: number | null;
  request_note: string;
  requested_at: Date | null;
  admin_note: string;
  approved_by: Types.ObjectId | null;
  approved_at: Date | null;
  last_used_at: Date | null;
  updated_at: Date;
}

const schema = new Schema<ISalaryBillAccess>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    status: { type: String, enum: ['pending', 'approved', 'rejected'], required: true },
    bill_limit: { type: Number, default: 0, min: 0 },
    bills_used: { type: Number, default: 0, min: 0 },
    request_pending: { type: Boolean, default: false },
    requested_bulks: { type: Number, default: null },
    requested_bills: { type: Number, default: null },
    request_note: { type: String, default: '' },
    requested_at: { type: Date, default: null },
    admin_note: { type: String, default: '' },
    approved_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approved_at: { type: Date, default: null },
    last_used_at: { type: Date, default: null },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ status: 1, updated_at: -1 });

export const SalaryBillAccess = mongoose.model<ISalaryBillAccess>(
  'SalaryBillAccess',
  schema,
  'salary_bill_access',
);
