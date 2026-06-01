import mongoose, { Schema, type Document } from 'mongoose';

export interface IQuestionType extends Document {
  name: string;
  code: string;
  has_options: boolean;
  note?: string;
  is_active: boolean;
}

const schema = new Schema<IQuestionType>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    has_options: { type: Boolean, default: true },
    note: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

export const QuestionType = mongoose.model<IQuestionType>('QuestionType', schema, 'question_types');
