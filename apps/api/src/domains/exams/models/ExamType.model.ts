import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExamType extends Document {
  exam_name_id: Types.ObjectId;
  name: string;
  code?: string;
  description?: string;
  total_marks: number;
  pass_marks: number;
  total_time: number;
  note?: string;
  is_active: boolean;
}

const schema = new Schema<IExamType>(
  {
    exam_name_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamName' },
    name: { type: String, required: true },
    code: { type: String },
    description: { type: String },
    total_marks: { type: Number, required: true },
    pass_marks: { type: Number, required: true },
    total_time: { type: Number, required: true },
    note: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ exam_name_id: 1, is_active: 1 });

export const ExamType = mongoose.model<IExamType>('ExamType', schema, 'exam_types');
