import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExplanationSubsection {
  subtitle: string;
  details?: string;
  note?: string;
}

export interface IExplanationSection {
  title: string;
  details?: string;
  note?: string;
  subsections: IExplanationSubsection[];
}

export interface IQuestionAnswerDetail extends Document {
  question_id: Types.ObjectId;
  /** @deprecated Legacy plain-text model answer; use model_answer_sections */
  model_answer?: string;
  model_answer_sections?: IExplanationSection[];
  /** @deprecated Legacy plain-text explanation; use explanation_sections */
  explanation?: string;
  explanation_sections?: IExplanationSection[];
  note?: string;
  reference_regulation_id?: Types.ObjectId;
}

const subsectionSchema = new Schema<IExplanationSubsection>(
  {
    subtitle: { type: String, required: true, default: '' },
    details: { type: String },
    note: { type: String },
  },
  { _id: false },
);

const sectionSchema = new Schema<IExplanationSection>(
  {
    title: { type: String, required: true, default: '' },
    details: { type: String },
    note: { type: String },
    subsections: { type: [subsectionSchema], default: [] },
  },
  { _id: false },
);

const schema = new Schema<IQuestionAnswerDetail>(
  {
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question', unique: true },
    model_answer: { type: String },
    model_answer_sections: { type: [sectionSchema], default: undefined },
    explanation: { type: String },
    explanation_sections: { type: [sectionSchema], default: undefined },
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
