import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISyllabusTopic extends Document {
  syllabus_group_id?: Types.ObjectId;
  exam_subject_id?: Types.ObjectId;
  name: string;
  description?: string;
  marks_weightage?: number;
  sort_order: number;
  is_active: boolean;
}

const schema = new Schema<ISyllabusTopic>(
  {
    syllabus_group_id: { type: Schema.Types.ObjectId, ref: 'SyllabusGroup' },
    exam_subject_id: { type: Schema.Types.ObjectId, ref: 'ExamSubject' },
    name: { type: String, required: true },
    description: { type: String },
    marks_weightage: { type: Number },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ syllabus_group_id: 1, sort_order: 1 });
schema.index({ exam_subject_id: 1, sort_order: 1 });

export const SyllabusTopic = mongoose.model<ISyllabusTopic>('SyllabusTopic', schema, 'syllabus_topics');
