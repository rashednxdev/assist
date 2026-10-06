import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISalaryUserOffice extends Document {
  user_id: Types.ObjectId;
  /** Top-level office in the org directory. */
  circle_id: Types.ObjectId | null;
  /** Null when the user chose Others and typed the office name. */
  office_id: Types.ObjectId | null;
  other_office_name: string;
  other_office_name_bn: string;
  updated_at: Date;
}

const schema = new Schema<ISalaryUserOffice>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    circle_id: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    office_id: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    other_office_name: { type: String, default: '' },
    other_office_name_bn: { type: String, default: '' },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ office_id: 1, _id: 1 });

export const SalaryUserOffice = mongoose.model<ISalaryUserOffice>('SalaryUserOffice', schema, 'salary_user_offices');
