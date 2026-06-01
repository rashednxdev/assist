import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBookPart extends Document {
  book_info_id: Types.ObjectId;
  name: string;
  short_name?: string;
  description?: string;
  part_number: number;
  is_active: boolean;
}

const schema = new Schema<IBookPart>(
  {
    book_info_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookInfo' },
    name: { type: String, required: true },
    short_name: { type: String },
    description: { type: String },
    part_number: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ book_info_id: 1, part_number: 1 });

export const BookPart = mongoose.model<IBookPart>('BookPart', schema, 'book_parts');
