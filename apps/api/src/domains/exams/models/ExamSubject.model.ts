import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExamSubject extends Document {
  exam_part_id: Types.ObjectId;
  exam_type_id: Types.ObjectId;
  name: string;
  name_bn?: string;
  total_marks: number;
  total_marks_bn?: string;
  pass_marks: number;
  pass_marks_bn?: string;
  is_active: boolean;
}

const schema = new Schema<IExamSubject>(
  {
    exam_part_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamPart' },
    exam_type_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamType' },
    name: { type: String, required: true },
    name_bn: { type: String },
    total_marks: { type: Number, required: true },
    total_marks_bn: { type: String },
    pass_marks: { type: Number, required: true },
    pass_marks_bn: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ exam_part_id: 1, is_active: 1 });
schema.index({ exam_type_id: 1 });
schema.index(
  { exam_part_id: 1, exam_type_id: 1, name: 1 },
  { unique: true, partialFilterExpression: { is_active: true } },
);

export const ExamSubject = mongoose.model<IExamSubject>('ExamSubject', schema, 'exam_subjects');
