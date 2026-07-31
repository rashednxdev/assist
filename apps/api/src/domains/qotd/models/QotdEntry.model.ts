import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IQotdEntry extends Document {
  exam_subject_id: Types.ObjectId;
  /** Calendar day as YYYY-MM-DD — a plain string so it can't drift across a timezone conversion. */
  date: string;
  /** HH:mm — hidden from regular users until this time on `date`. */
  publish_time: string;
  question_ids: Types.ObjectId[];
  created_by: Types.ObjectId;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IQotdEntry>(
  {
    exam_subject_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamSubject' },
    date: { type: String, required: true },
    publish_time: { type: String, required: true, default: '00:00' },
    question_ids: [{ type: Schema.Types.ObjectId, required: true, ref: 'Question' }],
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index(
  { exam_subject_id: 1, date: 1 },
  { unique: true, partialFilterExpression: { is_active: true } },
);
schema.index({ date: -1 });

export const QotdEntry = mongoose.model<IQotdEntry>('QotdEntry', schema, 'qotd_entries');
