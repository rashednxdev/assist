import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISalaryTrNotice extends Document {
  key: 'global';
  body_bn: string;
  body_en: string;
  confirm_bn: string;
  confirm_en: string;
  /** False hides the free T.R. Form notice. Missing means shown. */
  shown: boolean;
  updated_by: Types.ObjectId | null;
  updated_at: Date | null;
}

const schema = new Schema<ISalaryTrNotice>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    body_bn: { type: String, default: '', maxlength: 80000 },
    body_en: { type: String, default: '', maxlength: 80000 },
    confirm_bn: { type: String, default: '', maxlength: 500 },
    confirm_en: { type: String, default: '', maxlength: 500 },
    shown: { type: Boolean, default: true },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updated_at: { type: Date, default: null },
  },
  { timestamps: false },
);

export const SalaryTrNotice = mongoose.model<ISalaryTrNotice>('SalaryTrNotice', schema, 'salary_tr_notices');
