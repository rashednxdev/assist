import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExamPart extends Document {
  exam_name_id: Types.ObjectId;
  name: string;
  name_bn?: string;
  part_number: number;
  description?: string;
  total_marks: number;
  total_marks_bn?: string;
  pass_marks: number;
  pass_marks_bn?: string;
  qualifier_outline?: string;
  note?: string;
  is_active: boolean;
}

const schema = new Schema<IExamPart>(
  {
    exam_name_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamName' },
    name: { type: String, required: true },
    name_bn: { type: String },
    part_number: { type: Number, required: true },
    description: { type: String },
    total_marks: { type: Number, required: true },
    total_marks_bn: { type: String },
    pass_marks: { type: Number, required: true },
    pass_marks_bn: { type: String },
    qualifier_outline: { type: String },
    note: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ exam_name_id: 1, part_number: 1 }, { unique: true });

export const ExamPart = mongoose.model<IExamPart>('ExamPart', schema, 'exam_parts');
