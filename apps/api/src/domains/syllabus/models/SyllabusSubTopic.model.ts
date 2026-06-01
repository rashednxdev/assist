import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ISyllabusSubTopic extends Document {
  syllabus_topic_id: Types.ObjectId;
  name: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
}

const schema = new Schema<ISyllabusSubTopic>(
  {
    syllabus_topic_id: { type: Schema.Types.ObjectId, required: true, ref: 'SyllabusTopic' },
    name: { type: String, required: true },
    description: { type: String },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ syllabus_topic_id: 1, sort_order: 1 });

export const SyllabusSubTopic = mongoose.model<ISyllabusSubTopic>('SyllabusSubTopic', schema, 'syllabus_sub_topics');
