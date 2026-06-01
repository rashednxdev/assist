import mongoose, { Schema, type Document } from 'mongoose';

export interface IBookType extends Document {
  name: string;
  name_bn: string;
  code: string;
  description?: string;
  notes?: string;
  icon?: string;
  sort_order: number;
  is_active: boolean;
}

const schema = new Schema<IBookType>(
  {
    name: { type: String, required: true },
    name_bn: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: { type: String },
    notes: { type: String },
    icon: { type: String },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

export const BookType = mongoose.model<IBookType>('BookType', schema, 'book_types');
