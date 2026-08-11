import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IQuestionSubjectLink extends Document {
  question_id: Types.ObjectId;
  exam_subject_id: Types.ObjectId;
  sort_order: number;
  is_active: boolean;
  deactivated_by_trash?: boolean;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IQuestionSubjectLink>(
  {
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question' },
    exam_subject_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamSubject' },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    deactivated_by_trash: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ question_id: 1, is_active: 1, sort_order: 1 });
schema.index({ exam_subject_id: 1, is_active: 1 });
schema.index(
  { question_id: 1, exam_subject_id: 1 },
  { unique: true, partialFilterExpression: { is_active: true } },
);

export const QuestionSubjectLink = mongoose.model<IQuestionSubjectLink>(
  'QuestionSubjectLink',
  schema,
  'question_subject_links',
);
