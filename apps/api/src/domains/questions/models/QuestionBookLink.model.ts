import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { QuestionLinkLevel } from '@ibas/shared-constants';

export interface IQuestionBookLink extends Document {
  question_id: Types.ObjectId;
  link_level: QuestionLinkLevel;
  book_chapter_id: Types.ObjectId;
  book_topic_id?: Types.ObjectId;
  book_sub_topic_id?: Types.ObjectId;
  regulation_id?: Types.ObjectId;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IQuestionBookLink>(
  {
    question_id: { type: Schema.Types.ObjectId, required: true, ref: 'Question' },
    link_level: { type: String, required: true, enum: ['chapter', 'rule', 'sub_rule'] },
    book_chapter_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookChapter' },
    book_topic_id: { type: Schema.Types.ObjectId, ref: 'BookTopic' },
    book_sub_topic_id: { type: Schema.Types.ObjectId, ref: 'BookSubTopic' },
    regulation_id: { type: Schema.Types.ObjectId, ref: 'Regulation' },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ question_id: 1, is_active: 1, sort_order: 1 });
schema.index({ book_chapter_id: 1, is_active: 1 });
schema.index({ book_topic_id: 1, is_active: 1 });
schema.index({ book_sub_topic_id: 1, is_active: 1 });
schema.index(
  { question_id: 1, book_chapter_id: 1 },
  { unique: true, partialFilterExpression: { is_active: true, link_level: 'chapter' } },
);
schema.index(
  { question_id: 1, book_topic_id: 1 },
  { unique: true, partialFilterExpression: { is_active: true, link_level: 'rule' } },
);
schema.index(
  { question_id: 1, book_sub_topic_id: 1 },
  { unique: true, partialFilterExpression: { is_active: true, link_level: 'sub_rule' } },
);

export const QuestionBookLink = mongoose.model<IQuestionBookLink>(
  'QuestionBookLink',
  schema,
  'question_book_links',
);
