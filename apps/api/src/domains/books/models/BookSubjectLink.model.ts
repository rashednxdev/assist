import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBookSubjectLink extends Document {
  book_info_id: Types.ObjectId;
  exam_subject_id: Types.ObjectId;
  /** Order of this book within the subject (lower first) — drives Rule Library / mobile Books & Tools sort. */
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IBookSubjectLink>(
  {
    book_info_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookInfo' },
    exam_subject_id: { type: Schema.Types.ObjectId, required: true, ref: 'ExamSubject' },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ book_info_id: 1, is_active: 1 });
schema.index({ exam_subject_id: 1, is_active: 1, sort_order: 1 });
schema.index(
  { book_info_id: 1, exam_subject_id: 1 },
  { unique: true, partialFilterExpression: { is_active: true } },
);

export const BookSubjectLink = mongoose.model<IBookSubjectLink>(
  'BookSubjectLink',
  schema,
  'book_subject_links',
);
