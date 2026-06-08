import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBookTopic extends Document {
  book_chapter_id: Types.ObjectId;
  name?: string;
  sub_name?: string;
  rule_number: string;
  description?: string;
  note?: string;
  effective_date?: Date;
  is_amended: boolean;
  sort_order: number;
  is_active: boolean;
}

const schema = new Schema<IBookTopic>(
  {
    book_chapter_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookChapter' },
    name: { type: String, default: '' },
    sub_name: { type: String },
    rule_number: { type: String, required: true },
    description: { type: String },
    note: { type: String },
    effective_date: { type: Date },
    is_amended: { type: Boolean, default: false },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ book_chapter_id: 1, sort_order: 1 });
schema.index({ rule_number: 1 });

export const BookTopic = mongoose.model<IBookTopic>('BookTopic', schema, 'book_topics');
