import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IPaperDetail extends Document {
  exam_subject_id: Types.ObjectId;
  paper_type_id: Types.ObjectId;
  name: string;
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  instructions?: string;
  is_published: boolean;
  is_active: boolean;
  created_by: Types.ObjectId;
  created_at: Date;
}

const schema = new Schema<IPaperDetail>(
  {
    exam_subject_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamSubject' },
    paper_type_id: { type: Schema.Types.ObjectId, required: true, ref: 'PaperType' },
    name: { type: String, required: true },
    total_marks: { type: Number, required: true },
    pass_marks: { type: Number, required: true },
    duration_minutes: { type: Number, required: true },
    instructions: { type: String },
    is_published: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ exam_subject_id: 1, is_published: 1 });
schema.index({ paper_type_id: 1 });

export const PaperDetail = mongoose.model<IPaperDetail>('PaperDetail', schema, 'paper_details');
