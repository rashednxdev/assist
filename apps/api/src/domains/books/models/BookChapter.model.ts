import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBookChapter extends Document {
  book_info_id: Types.ObjectId;
  book_parts_id?: Types.ObjectId;
  name?: string;
  sub_name?: string;
  chapter_number: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
}

const schema = new Schema<IBookChapter>(
  {
    book_info_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookInfo' },
    book_parts_id: { type: Schema.Types.ObjectId, ref: 'BookPart' },
    name: { type: String, default: '' },
    sub_name: { type: String },
    chapter_number: { type: String, required: true },
    description: { type: String },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ book_info_id: 1, sort_order: 1 });
schema.index({ book_parts_id: 1 });

export const BookChapter = mongoose.model<IBookChapter>('BookChapter', schema, 'book_chapters');
