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

export interface IComparisonTableRow {
  feature: string;
  values: string[];
}

export interface IComparisonTable {
  feature_header: string;
  columns: string[];
  rows: IComparisonTableRow[];
}

export interface IQuestionAnswerDetail extends Document {
  question_id: Types.ObjectId;
  /** @deprecated Legacy plain-text model answer; use model_answer_sections */
  model_answer?: string;
  model_answer_sections?: IExplanationSection[];
  /** Comparison table for DIFFERENCES question type. */
  model_answer_comparison?: IComparisonTable;
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

const comparisonRowSchema = new Schema<IComparisonTableRow>(
  {
    feature: { type: String, default: '' },
    values: { type: [String], default: [] },
  },
  { _id: false },
);

const comparisonTableMongooseSchema = new Schema<IComparisonTable>(
  {
    feature_header: { type: String, default: 'Feature' },
    columns: { type: [String], default: [] },
    rows: { type: [comparisonRowSchema], default: [] },
  },
  { _id: false },
);

const schema = new Schema<IQuestionAnswerDetail>(
  {
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question', unique: true },
    model_answer: { type: String },
    model_answer_sections: { type: [sectionSchema], default: undefined },
    model_answer_comparison: { type: comparisonTableMongooseSchema, default: undefined },
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
