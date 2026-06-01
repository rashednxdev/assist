import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IPaperQuestion extends Document {
  paper_id: Types.ObjectId;
  paper_group_id?: Types.ObjectId;
  question_id: Types.ObjectId;
  question_number: number;
  marks: number;
  is_compulsory: boolean;
  is_active: boolean;
}

const schema = new Schema<IPaperQuestion>(
  {
    paper_id: { type: Schema.Types.ObjectId, required: true, ref: 'PaperDetail' },
    paper_group_id: { type: Schema.Types.ObjectId, ref: 'PaperGroup' },
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question' },
    question_number: { type: Number, required: true },
    marks: { type: Number, required: true },
    is_compulsory: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ paper_id: 1, question_number: 1 }, { unique: true });
schema.index({ question_id: 1 });

export const PaperQuestion = mongoose.model<IPaperQuestion>('PaperQuestion', schema, 'paper_questions');
