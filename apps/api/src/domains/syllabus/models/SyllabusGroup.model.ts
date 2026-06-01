import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISyllabusGroup extends Document {
  exam_subject_id: Types.ObjectId;
  name: string;
  marks_allocated: number;
  sort_order: number;
  is_active: boolean;
}

const schema = new Schema<ISyllabusGroup>(
  {
    exam_subject_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamSubject' },
    name: { type: String, required: true },
    marks_allocated: { type: Number, required: true },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ exam_subject_id: 1, sort_order: 1 });

export const SyllabusGroup = mongoose.model<ISyllabusGroup>('SyllabusGroup', schema, 'syllabus_groups');
