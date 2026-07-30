import mongoose, { Schema, type Document, type Types } from 'mongoose';

/**
 * One submitted MCQ exam attempt on a paper (papers/[id] "Start exam" flow, mobile only).
 * Multiple attempts per user/paper are allowed (retakes) — this is a history log, not a
 * current-state row like UserQuestionEvaluation.
 */
export interface IPaperAttempt extends Document {
  user_id: Types.ObjectId;
  paper_id: Types.ObjectId;
  total_questions: number;
  answered_count: number;
  correct_count: number;
  total_marks: number;
  scored_marks: number;
  pass_marks: number;
  is_pass: boolean;
  duration_seconds?: number;
  submitted_at: Date;
}

const schema = new Schema<IPaperAttempt>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    paper_id: { type: Schema.Types.ObjectId, required: true, ref: 'PaperDetail' },
    total_questions: { type: Number, required: true, min: 0 },
    answered_count: { type: Number, required: true, min: 0 },
    correct_count: { type: Number, required: true, min: 0 },
    total_marks: { type: Number, required: true, min: 0 },
    scored_marks: { type: Number, required: true, min: 0 },
    pass_marks: { type: Number, required: true, min: 0 },
    is_pass: { type: Boolean, required: true },
    duration_seconds: { type: Number, min: 0 },
    submitted_at: { type: Date, required: true, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ user_id: 1, paper_id: 1, submitted_at: -1 });

export const PaperAttempt = mongoose.model<IPaperAttempt>(
  'PaperAttempt',
  schema,
  'paper_attempts',
);
