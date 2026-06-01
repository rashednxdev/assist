import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IQuestionAnswer extends Document {
  question_id: Types.ObjectId;
  option_id: Types.ObjectId;
  is_correct: boolean;
}

const schema = new Schema<IQuestionAnswer>(
  {
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question' },
    option_id: { type: Schema.Types.ObjectId, required: true, ref: 'QuestionOption' },
    is_correct: { type: Boolean, required: true },
  },
  { timestamps: false },
);

schema.index({ question_id: 1, option_id: 1 }, { unique: true });

export const QuestionAnswer = mongoose.model<IQuestionAnswer>('QuestionAnswer', schema, 'question_answers');
