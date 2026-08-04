import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IProcessStep {
  title: string;
  description?: string;
  role?: string;
}

export interface IProcess extends Document {
  book_topic_id: Types.ObjectId;
  title: string;
  details?: string;
  steps: IProcessStep[];
  sort_order: number;
  is_active: boolean;
}

const processStepSchema = new Schema<IProcessStep>(
  {
    title: { type: String, required: true },
    description: { type: String },
    role: { type: String },
  },
  { _id: false },
);

const schema = new Schema<IProcess>(
  {
    book_topic_id: { type: Schema.Types.ObjectId, required: true, ref: 'BookTopic' },
    title: { type: String, required: true },
    details: { type: String },
    steps: { type: [processStepSchema], default: [] },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ book_topic_id: 1, sort_order: 1 });

export const Process = mongoose.model<IProcess>('Process', schema, 'book_topic_processes');
