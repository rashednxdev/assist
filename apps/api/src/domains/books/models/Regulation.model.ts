import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IRegulation extends Document {
  book_info_id: Types.ObjectId;
  book_chapter_id?: Types.ObjectId;
  book_topic_id?: Types.ObjectId;
  regulation_no: string;
  title: string;
  full_text: string;
  regulation_type: string;
  effective_date: Date;
  is_active: boolean;
  is_amended: boolean;
  applicable_to: string[];
  payment_related: boolean;
  receipt_related: boolean;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IRegulation>(
  {
    book_info_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookInfo' },
    book_chapter_id: { type: Schema.Types.ObjectId, ref: 'BookChapter' },
    book_topic_id: { type: Schema.Types.ObjectId, ref: 'BookTopic' },
    regulation_no: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    full_text: { type: String, required: true },
    regulation_type: { type: String, required: true },
    effective_date: { type: Date, required: true },
    is_active: { type: Boolean, default: true },
    is_amended: { type: Boolean, default: false },
    applicable_to: { type: [String], default: ['all'] },
    payment_related: { type: Boolean, default: false },
    receipt_related: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ book_info_id: 1, is_active: 1 });
schema.index({ payment_related: 1 });
schema.index({ tags: 1 });
schema.index({ title: 'text', full_text: 'text', regulation_no: 'text' });

export const Regulation = mongoose.model<IRegulation>('Regulation', schema, 'regulations');
