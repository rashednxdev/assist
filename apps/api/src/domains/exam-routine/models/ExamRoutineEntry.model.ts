import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExamRoutineEntry extends Document {
  exam_routine_id: Types.ObjectId;
  exam_subject_id: Types.ObjectId;
  date: string;
  /** HH:mm — a plain string avoids the timezone ambiguity a bare time-of-day Date would carry. */
  time: string;
  instruction?: string;
  sort_order: number;
  is_active: boolean;
}

const schema = new Schema<IExamRoutineEntry>(
  {
    exam_routine_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamRoutine' },
    exam_subject_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamSubject' },
    date: { type: String, required: true },
    time: { type: String, required: true },
    instruction: { type: String },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ exam_routine_id: 1, date: 1 });
schema.index(
  { exam_routine_id: 1, exam_subject_id: 1 },
  { unique: true, partialFilterExpression: { is_active: true } },
);

export const ExamRoutineEntry = mongoose.model<IExamRoutineEntry>(
  'ExamRoutineEntry',
  schema,
  'exam_routine_entries',
);
