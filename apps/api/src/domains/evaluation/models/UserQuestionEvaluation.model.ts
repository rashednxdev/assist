import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { SelfRatingLevel } from '@ibas/shared-constants';

export interface IUserQuestionEvaluation extends Document {
  user_id: Types.ObjectId;
  question_id: Types.ObjectId;
  selected_option_id?: Types.ObjectId;
  is_correct?: boolean;
  self_rating?: SelfRatingLevel;
  progress_index: number;
  updated_at: Date;
}

const schema = new Schema<IUserQuestionEvaluation>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question' },
    selected_option_id: { type: Schema.Types.ObjectId, ref: 'QuestionOption' },
    is_correct: { type: Boolean },
    self_rating: { type: String, enum: ['overall', 'understand', 'confidence'] },
    progress_index: { type: Number, required: true, min: 0, max: 100 },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ user_id: 1, question_id: 1 }, { unique: true });
schema.index({ question_id: 1 });

export const UserQuestionEvaluation = mongoose.model<IUserQuestionEvaluation>(
  'UserQuestionEvaluation',
  schema,
  'user_question_evaluations',
);
