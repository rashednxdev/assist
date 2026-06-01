import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IPaperGroup extends Document {
  paper_id: Types.ObjectId;
  name: string;
  group_number: number;
  marks: number;
  instructions?: string;
  is_active: boolean;
}

const schema = new Schema<IPaperGroup>(
  {
    paper_id: { type: Schema.Types.ObjectId, required: true, ref: 'PaperDetail' },
    name: { type: String, required: true },
    group_number: { type: Number, required: true },
    marks: { type: Number, required: true },
    instructions: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ paper_id: 1, group_number: 1 }, { unique: true });

export const PaperGroup = mongoose.model<IPaperGroup>('PaperGroup', schema, 'paper_groups');
