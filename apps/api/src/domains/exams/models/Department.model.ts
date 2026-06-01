import mongoose, { Schema, type Document } from 'mongoose';

export interface IDepartment extends Document {
  name: string;
  short_name: string;
  identity?: string;
  location?: string;
  address?: string;
  website?: string;
  is_active: boolean;
}

const schema = new Schema<IDepartment>(
  {
    name: { type: String, required: true },
    short_name: { type: String, required: true, unique: true },
    identity: { type: String },
    location: { type: String },
    address: { type: String },
    website: { type: String },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

export const Department = mongoose.model<IDepartment>('ExamDepartment', schema, 'departments');
