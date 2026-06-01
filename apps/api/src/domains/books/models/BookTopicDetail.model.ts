import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBookTopicDetail extends Document {
  book_topic_id: Types.ObjectId;
  detail_text: string;
  sort_order: number;
  is_active: boolean;
}

const schema = new Schema<IBookTopicDetail>(
  {
    book_topic_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookTopic' },
    detail_text: { type: String, required: true },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ book_topic_id: 1, sort_order: 1 });

export const BookTopicDetail = mongoose.model<IBookTopicDetail>('BookTopicDetail', schema, 'book_topic_details');
