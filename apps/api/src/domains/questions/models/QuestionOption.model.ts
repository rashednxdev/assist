import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IQuestionOption extends Document {
  question_id: Types.ObjectId;
  option_key: string;
  option_text_en: string;
  option_text_bn?: string;
}

const schema = new Schema<IQuestionOption>(
  {
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question' },
    option_key: { type: String, required: true },
    option_text_en: { type: String, required: true },
    option_text_bn: { type: String },
  },
  { timestamps: false },
);

schema.index({ question_id: 1, option_key: 1 }, { unique: true });

export const QuestionOption = mongoose.model<IQuestionOption>('QuestionOption', schema, 'question_options');
