import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** An MCQ filed under an iBAS++ area in the archive's "Know, Because you asked any more". */
export interface IKnowQuestion extends Document {
  area_code: string;
  question_id: Types.ObjectId;
  sort_order: number;
  created_by: Types.ObjectId;
  created_at: Date;
}

const schema = new Schema<IKnowQuestion>(
  {
    area_code: { type: String, required: true },
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question' },
    sort_order: { type: Number, default: 0 },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

schema.index({ area_code: 1, question_id: 1 }, { unique: true });
schema.index({ question_id: 1 });

export const KnowQuestion = mongoose.model<IKnowQuestion>('KnowQuestion', schema, 'archive_know_questions');
