import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISalaryCalcGuide extends Document {
  key: 'global';
  body_bn: string;
  body_en: string;
  updated_by: Types.ObjectId | null;
  updated_at: Date | null;
}

const schema = new Schema<ISalaryCalcGuide>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    body_bn: { type: String, default: '', maxlength: 80000 },
    body_en: { type: String, default: '', maxlength: 80000 },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updated_at: { type: Date, default: null },
  },
  { timestamps: false },
);

export const SalaryCalcGuide = mongoose.model<ISalaryCalcGuide>('SalaryCalcGuide', schema, 'salary_calc_guides');
