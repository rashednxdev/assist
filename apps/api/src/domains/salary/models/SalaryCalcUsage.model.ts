import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISalaryCalcUsage extends Document {
  user_id: Types.ObjectId;
  /** Free arrears calculations used, up to SALARY_FREE_ARREARS_CALCS. */
  free_used: number;
  /** Paid-phase calculations not yet downloaded; one bill is charged when it reaches SALARY_CALCS_PER_BILL. */
  unprinted: number;
  total: number;
  free_tr_used: boolean;
  updated_at: Date;
}

const schema = new Schema<ISalaryCalcUsage>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    free_used: { type: Number, default: 0, min: 0 },
    unprinted: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    free_tr_used: { type: Boolean, default: false },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const SalaryCalcUsage = mongoose.model<ISalaryCalcUsage>('SalaryCalcUsage', schema, 'salary_calc_usage');
