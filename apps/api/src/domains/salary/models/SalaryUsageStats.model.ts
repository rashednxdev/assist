import mongoose, { Schema, type Document } from 'mongoose';

export interface ISalaryUsageStats extends Document {
  key: 'global';
  calculate_all_phases_count: number;
  pdf_download_count: number;
  last_calculate_at: Date | null;
  last_pdf_at: Date | null;
}

const schema = new Schema<ISalaryUsageStats>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    calculate_all_phases_count: { type: Number, default: 0 },
    pdf_download_count: { type: Number, default: 0 },
    last_calculate_at: { type: Date, default: null },
    last_pdf_at: { type: Date, default: null },
  },
  { timestamps: false },
);

export const SalaryUsageStats = mongoose.model<ISalaryUsageStats>(
  'SalaryUsageStats',
  schema,
  'salary_usage_stats',
);
