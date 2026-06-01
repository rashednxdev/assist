import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IExamName extends Document {
  authority_id: Types.ObjectId;
  name: string;
  short_name: string;
  goal?: string;
  description?: string;
  eligibility_criteria?: string;
  passing_criteria?: string;
  total_attempts_allowed?: number;
  registration_fee: number;
  is_active: boolean;
  created_at: Date;
}

const schema = new Schema<IExamName>(
  {
    authority_id: { type: Schema.Types.ObjectId, required: true, ref: 'Authority' },
    name: { type: String, required: true },
    short_name: { type: String, required: true, unique: true },
    goal: { type: String },
    description: { type: String },
    eligibility_criteria: { type: String },
    passing_criteria: { type: String },
    total_attempts_allowed: { type: Number },
    registration_fee: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ authority_id: 1, is_active: 1 });

export const ExamName = mongoose.model<IExamName>('ExamName', schema, 'exam_names');
