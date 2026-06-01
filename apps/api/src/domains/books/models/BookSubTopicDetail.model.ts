import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBookSubTopicDetail extends Document {
  book_sub_topic_id: Types.ObjectId;
  detail_text: string;
  sort_order: number;
  is_active: boolean;
}

const schema = new Schema<IBookSubTopicDetail>(
  {
    book_sub_topic_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookSubTopic' },
    detail_text: { type: String, required: true },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ book_sub_topic_id: 1, sort_order: 1 });

export const BookSubTopicDetail = mongoose.model<IBookSubTopicDetail>(
  'BookSubTopicDetail',
  schema,
  'book_sub_topic_details',
);
