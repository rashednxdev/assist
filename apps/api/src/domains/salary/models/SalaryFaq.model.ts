import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISalaryFaq extends Document {
  question_bn: string;
  question_en: string;
  answer_bn: string;
  answer_en: string;
  status: 'pending' | 'published' | 'rejected';
  pinned: boolean;
  circular_ids: Types.ObjectId[];
  asked_by: Types.ObjectId | null;
  asker_name: string;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ISalaryFaq>(
  {
    question_bn: { type: String, default: '', maxlength: 500 },
    question_en: { type: String, default: '', maxlength: 500 },
    answer_bn: { type: String, default: '', maxlength: 4000 },
    answer_en: { type: String, default: '', maxlength: 4000 },
    status: { type: String, enum: ['pending', 'published', 'rejected'], required: true, index: true },
    pinned: { type: Boolean, default: false },
    circular_ids: { type: [Schema.Types.ObjectId], ref: 'SalaryCircular', default: [] },
    asked_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    asker_name: { type: String, default: '', maxlength: 160 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ status: 1, pinned: -1, created_at: -1 });
schema.index({ asked_by: 1, status: 1 });

export const SalaryFaq = mongoose.model<ISalaryFaq>('SalaryFaq', schema, 'salary_faqs');
