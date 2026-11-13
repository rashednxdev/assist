import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISalaryCircular extends Document {
  title_bn: string;
  title_en: string;
  circular_no: string;
  /** YYYY-MM-DD */
  publish_date: string;
  source_url: string;
  source_name: string;
  summary_bn: string;
  summary_en: string;
  is_published: boolean;
  created_by: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ISalaryCircular>(
  {
    title_bn: { type: String, default: '', maxlength: 300 },
    title_en: { type: String, default: '', maxlength: 300 },
    circular_no: { type: String, default: '', maxlength: 80 },
    publish_date: { type: String, required: true },
    source_url: { type: String, required: true, maxlength: 1000 },
    source_name: { type: String, required: true, maxlength: 160 },
    summary_bn: { type: String, default: '', maxlength: 1000 },
    summary_en: { type: String, default: '', maxlength: 1000 },
    is_published: { type: Boolean, default: true, index: true },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ is_published: 1, publish_date: -1, created_at: -1 });

export const SalaryCircular = mongoose.model<ISalaryCircular>('SalaryCircular', schema, 'salary_circulars');
