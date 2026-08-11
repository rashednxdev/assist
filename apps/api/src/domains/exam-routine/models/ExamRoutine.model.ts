import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExamRoutine extends Document {
  exam_name_id: Types.ObjectId;
  /** Countdown target / routine start — YYYY-MM-DD, kept as a plain string like QotdEntry.date. */
  start_date: string;
  /** Optional note shown with the countdown on mobile. */
  start_date_note?: string;
  is_active: boolean;
  created_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IExamRoutine>(
  {
    exam_name_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamName' },
    start_date: { type: String, required: true },
    start_date_note: { type: String },
    is_active: { type: Boolean, default: true },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ exam_name_id: 1 }, { unique: true, partialFilterExpression: { is_active: true } });

export const ExamRoutine = mongoose.model<IExamRoutine>('ExamRoutine', schema, 'exam_routines');
