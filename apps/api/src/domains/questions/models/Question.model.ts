import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { QUESTION_REVIEW_STATUSES, type QuestionReviewStatus } from '@ibas/shared-constants';

export interface IQuestion extends Document {
  question_type_id: Types.ObjectId;
  question_type_code: string;
  book_chapter_id?: Types.ObjectId;
  book_topic_id?: Types.ObjectId;
  book_sub_topic_id?: Types.ObjectId;
  regulation_id?: Types.ObjectId;
  body_en: string;
  body_bn?: string;
  difficulty: string;
  marks: number;
  negative_marks?: number;
  time_seconds: number;
  /** Kept in sync with review_status (true only when review_status === 'published') for every
   * existing is_published-based query (mobile sync, public listing, indexes) to keep working
   * unchanged. */
  is_published: boolean;
  review_status: QuestionReviewStatus;
  is_active: boolean;
  language: string;
  created_by: Types.ObjectId;
  reviewed_by?: Types.ObjectId;
  /**
   * When set, this question is a "prototype" of another ("mother") question — it shares the
   * mother's model answer. Editing the answer from either side edits the mother's copy, which
   * every prototype resolves to live. Only ever points to a question that is itself NOT a
   * prototype (no multi-hop chains — a mother can't also be a prototype of something else).
   */
  mother_question_id?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IQuestion>(
  {
    question_type_id: { type: Schema.Types.ObjectId, required: true, ref: 'QuestionType' },
    question_type_code: { type: String, required: true },
    book_chapter_id: { type: Schema.Types.ObjectId, ref: 'BookChapter' },
    book_topic_id: { type: Schema.Types.ObjectId, ref: 'BookTopic' },
    book_sub_topic_id: { type: Schema.Types.ObjectId, ref: 'BookSubTopic' },
    regulation_id: { type: Schema.Types.ObjectId, ref: 'Regulation' },
    body_en: { type: String, required: true },
    body_bn: { type: String },
    difficulty: { type: String, required: true },
    marks: { type: Number, required: true },
    negative_marks: { type: Number },
    time_seconds: { type: Number, required: true },
    is_published: { type: Boolean, default: false },
    review_status: { type: String, enum: QUESTION_REVIEW_STATUSES, default: 'draft' },
    is_active: { type: Boolean, default: true },
    language: { type: String, default: 'both' },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    reviewed_by: { type: Schema.Types.ObjectId, ref: 'User' },
    mother_question_id: { type: Schema.Types.ObjectId, ref: 'Question' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ book_chapter_id: 1, is_published: 1 });
schema.index({ book_topic_id: 1, is_published: 1 });
schema.index({ regulation_id: 1 });
schema.index({ difficulty: 1, is_published: 1 });
schema.index({ created_by: 1 });
schema.index({ review_status: 1 });
schema.index({ mother_question_id: 1 });

export const Question = mongoose.model<IQuestion>('Question', schema, 'questions');
