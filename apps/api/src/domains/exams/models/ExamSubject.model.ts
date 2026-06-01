import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExamSubject extends Document {
  exam_part_id: Types.ObjectId;
  exam_type_id: Types.ObjectId;
  name: string;
  total_marks: number;
  pass_marks: number;
  is_active: boolean;
}

const schema = new Schema<IExamSubject>(
  {
    exam_part_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamPart' },
    exam_type_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamType' },
    name: { type: String, required: true },
    total_marks: { type: Number, required: true },
    pass_marks: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ exam_part_id: 1, is_active: 1 });
schema.index({ exam_type_id: 1 });

export const ExamSubject = mongoose.model<IExamSubject>('ExamSubject', schema, 'exam_subjects');
