import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExamPart extends Document {
  exam_name_id: Types.ObjectId;
  name: string;
  part_number: number;
  description?: string;
  total_marks: number;
  pass_marks: number;
  qualifier_outline?: string;
  note?: string;
  is_active: boolean;
}

const schema = new Schema<IExamPart>(
  {
    exam_name_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamName' },
    name: { type: String, required: true },
    part_number: { type: Number, required: true },
    description: { type: String },
    total_marks: { type: Number, required: true },
    pass_marks: { type: Number, required: true },
    qualifier_outline: { type: String },
    note: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ exam_name_id: 1, part_number: 1 }, { unique: true });

export const ExamPart = mongoose.model<IExamPart>('ExamPart', schema, 'exam_parts');
