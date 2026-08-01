import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IPaperDetail extends Document {
  exam_subject_id: Types.ObjectId;
  paper_type_id: Types.ObjectId;
  name: string;
  session_year?: string;
  exam_session_id: Types.ObjectId;
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  instructions?: string;
  is_published: boolean;
  /** Independent publish channel — a paper can be a Practice Paper, an Exam of the Week, or both. */
  is_exam_of_week: boolean;
  /** YYYY-MM-DD — which day (and by extension, week) this paper is featured under. */
  exam_week_date?: string;
  /** HH:mm — hidden from regular users until this time on exam_week_date. */
  exam_week_publish_time?: string;
  is_active: boolean;
  created_by: Types.ObjectId;
  created_at: Date;
}

const schema = new Schema<IPaperDetail>(
  {
    exam_subject_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamSubject' },
    paper_type_id: { type: Schema.Types.ObjectId, required: true, ref: 'PaperType' },
    name: { type: String, required: true },
    session_year: { type: String },
    exam_session_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamSession' },
    total_marks: { type: Number, required: true },
    pass_marks: { type: Number, required: true },
    duration_minutes: { type: Number, required: true },
    instructions: { type: String },
    is_published: { type: Boolean, default: false },
    is_exam_of_week: { type: Boolean, default: false },
    exam_week_date: { type: String },
    exam_week_publish_time: { type: String },
    is_active: { type: Boolean, default: true },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ exam_subject_id: 1, is_published: 1 });
schema.index({ is_exam_of_week: 1, exam_week_date: 1 });
schema.index({ exam_session_id: 1 });
schema.index({ paper_type_id: 1 });
schema.index(
  { exam_subject_id: 1, exam_session_id: 1, paper_type_id: 1 },
  { unique: true, partialFilterExpression: { is_active: true } },
);

export const PaperDetail = mongoose.model<IPaperDetail>('PaperDetail', schema, 'paper_details');
