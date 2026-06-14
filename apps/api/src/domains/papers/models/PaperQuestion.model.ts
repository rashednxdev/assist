import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IPaperQuestion extends Document {
  paper_id: Types.ObjectId;
  paper_group_id?: Types.ObjectId;
  from_question_bank: boolean;
  question_id?: Types.ObjectId;
  header_text?: string;
  question_number: number;
  display_question_number?: string;
  marks: number;
  marks_display_bn?: string;
  is_compulsory: boolean;
  is_active: boolean;
}

const schema = new Schema<IPaperQuestion>(
  {
    paper_id: { type: Schema.Types.ObjectId, required: true, ref: 'PaperDetail' },
    paper_group_id: { type: Schema.Types.ObjectId, ref: 'PaperGroup' },
    from_question_bank: { type: Boolean, default: true },
    question_id: { type: Schema.Types.ObjectId, ref: 'Question' },
    header_text: { type: String },
    question_number: { type: Number, required: true },
    display_question_number: { type: String },
    marks: { type: Number, required: true },
    marks_display_bn: { type: String },
    is_compulsory: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index(
  { paper_id: 1, question_number: 1 },
  { unique: true, partialFilterExpression: { is_active: true } },
);
schema.index({ question_id: 1 }, { sparse: true });

export const PaperQuestion = mongoose.model<IPaperQuestion>('PaperQuestion', schema, 'paper_questions');
