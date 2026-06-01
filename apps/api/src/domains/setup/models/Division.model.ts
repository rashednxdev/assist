import mongoose, { Schema, type Document } from 'mongoose';

export interface IDivision extends Document {
  name_en: string;
  name_bn?: string;
  short_code: string;
  is_active: boolean;
}

const schema = new Schema<IDivision>(
  {
    name_en: { type: String, required: true },
    name_bn: { type: String },
    short_code: { type: String, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

export const Division = mongoose.model<IDivision>('Division', schema, 'divisions');
