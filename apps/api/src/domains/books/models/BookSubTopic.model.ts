import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBookSubTopic extends Document {
  book_topic_id: Types.ObjectId;
  name?: string;
  rule_number?: string;
  description?: string;
  note?: string;
  sort_order: number;
  is_active: boolean;
}

const schema = new Schema<IBookSubTopic>(
  {
    book_topic_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookTopic' },
    name: { type: String, default: '' },
    rule_number: { type: String },
    description: { type: String },
    note: { type: String },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ book_topic_id: 1, sort_order: 1 });

export const BookSubTopic = mongoose.model<IBookSubTopic>('BookSubTopic', schema, 'book_sub_topics');
