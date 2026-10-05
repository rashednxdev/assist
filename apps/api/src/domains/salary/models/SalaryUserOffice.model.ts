import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISalaryUserOffice extends Document {
  user_id: Types.ObjectId;
  /** Top-level office in the org directory. */
  circle_id: Types.ObjectId | null;
  /** Null when the user chose Others and typed the office name. */
  office_id: Types.ObjectId | null;
  other_office_name: string;
  updated_at: Date;
}

const schema = new Schema<ISalaryUserOffice>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    circle_id: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    office_id: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    other_office_name: { type: String, default: '' },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const SalaryUserOffice = mongoose.model<ISalaryUserOffice>('SalaryUserOffice', schema, 'salary_user_offices');
