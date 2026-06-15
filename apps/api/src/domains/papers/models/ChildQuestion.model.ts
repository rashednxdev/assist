import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IChildQuestion extends Document {
  paper_question_id: Types.ObjectId;
  question_id: Types.ObjectId;
  part_label: string;
  marks: number;
  marks_display_bn?: string;
  is_active: boolean;
}

const schema = new Schema<IChildQuestion>(
  {
    paper_question_id: { type: Schema.Types.ObjectId, required: true, ref: 'PaperQuestion' },
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question' },
    part_label: { type: String, required: true },
    marks: { type: Number, required: true },
    marks_display_bn: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index(
  { paper_question_id: 1, part_label: 1 },
  { unique: true, partialFilterExpression: { is_active: true } },
);

export const ChildQuestion = mongoose.model<IChildQuestion>('ChildQuestion', schema, 'child_questions');
