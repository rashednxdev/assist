import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IDesignation extends Document {
  name: string;
  name_bn?: string;
  short_name: string;
  /** National pay scale grade 1–20; null when not graded. */
  grade: number | null;
  serial_no: number;
  is_active: boolean;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IDesignation>(
  {
    name: { type: String, required: true, trim: true },
    name_bn: { type: String, trim: true },
    short_name: { type: String, required: true, trim: true },
    grade: { type: Number, default: null, min: 1, max: 20 },
    serial_no: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ serial_no: 1, grade: 1, name: 1 });

export const Designation = mongoose.model<IDesignation>('Designation', schema, 'designations');
