import mongoose, { Schema, type Document, type Types } from 'mongoose';

export type SubmittedQuestionStatus = 'pending' | 'accepted' | 'rejected';

export interface ISubmittedQuestion extends Document {
  user_id: Types.ObjectId;
  exam_subject_id: Types.ObjectId;
  body: string;
  status: SubmittedQuestionStatus;
  /** Set once an admin accepts this and creates/picks the real question that answers it. */
  linked_question_id?: Types.ObjectId;
  admin_note?: string;
  reviewed_by?: Types.ObjectId;
  reviewed_at?: Date;
  created_at: Date;
}

const schema = new Schema<ISubmittedQuestion>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    exam_subject_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamSubject' },
    body: { type: String, required: true },
    status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
    linked_question_id: { type: Schema.Types.ObjectId, ref: 'Question' },
    admin_note: { type: String },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewed_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

/** Used both to enforce the 10-per-subject submission cap and to list a user's own submissions. */
schema.index({ user_id: 1, exam_subject_id: 1 });
schema.index({ status: 1, created_at: -1 });

export const SubmittedQuestion = mongoose.model<ISubmittedQuestion>(
  'SubmittedQuestion',
  schema,
  'submitted_questions',
);
