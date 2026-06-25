import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExamSession extends Document {
  exam_name_id: Types.ObjectId;
  label_en: string;
  label_bn?: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
}

const schema = new Schema<IExamSession>(
  {
    exam_name_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamName' },
    label_en: { type: String, required: true },
    label_bn: { type: String },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ exam_name_id: 1, sort_order: -1 });
schema.index(
  { exam_name_id: 1, label_en: 1 },
  { unique: true, partialFilterExpression: { is_active: true } },
);

export const ExamSession = mongoose.model<IExamSession>('ExamSession', schema, 'exam_sessions');
