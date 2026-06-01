import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBookInfo extends Document {
  book_type_id: Types.ObjectId;
  name: string;
  name_bn: string;
  short_name: string;
  description: string;
  edition?: string;
  publish_date?: Date;
  published_by?: string;
  effective_date?: Date;
  is_part: boolean;
  language: string;
  cover_image_url?: string;
  is_active: boolean;
  is_superseded: boolean;
  superseded_by?: Types.ObjectId;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IBookInfo>(
  {
    book_type_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookType' },
    name: { type: String, required: true },
    name_bn: { type: String, required: true },
    short_name: { type: String, required: true },
    description: { type: String, required: true },
    edition: { type: String },
    publish_date: { type: Date },
    published_by: { type: String },
    effective_date: { type: Date },
    is_part: { type: Boolean, default: false },
    language: { type: String, default: 'both' },
    cover_image_url: { type: String },
    is_active: { type: Boolean, default: true },
    is_superseded: { type: Boolean, default: false },
    superseded_by: { type: Schema.Types.ObjectId },
    tags: { type: [String], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ book_type_id: 1, is_active: 1 });
schema.index({ tags: 1 });
schema.index({ is_superseded: 1 });

export const BookInfo = mongoose.model<IBookInfo>('BookInfo', schema, 'books_info');
