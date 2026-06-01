import mongoose, { Schema, type Document } from 'mongoose';

export interface IPaperType extends Document {
  name: string;
  code: string;
  description?: string;
  is_active: boolean;
}

const schema = new Schema<IPaperType>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

export const PaperType = mongoose.model<IPaperType>('PaperType', schema, 'paper_types');
