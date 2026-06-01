import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IQuestionAnswerDetail extends Document {
  question_id: Types.ObjectId;
  explanation: string;
  note?: string;
  reference_regulation_id?: Types.ObjectId;
}

const schema = new Schema<IQuestionAnswerDetail>(
  {
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question', unique: true },
    explanation: { type: String, required: true },
    note: { type: String },
    reference_regulation_id: { type: Schema.Types.ObjectId, ref: 'Regulation' },
  },
  { timestamps: false },
);

export const QuestionAnswerDetail = mongoose.model<IQuestionAnswerDetail>(
  'QuestionAnswerDetail',
  schema,
  'question_answer_details',
);
