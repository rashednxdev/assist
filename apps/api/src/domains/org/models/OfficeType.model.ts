import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IOfficeType extends Document {
  name: string;
  name_bn?: string;
  short_name: string;
  serial_no: number;
  is_active: boolean;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IOfficeType>(
  {
    name: { type: String, required: true, trim: true },
    name_bn: { type: String, trim: true },
    short_name: { type: String, required: true, trim: true },
    serial_no: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ serial_no: 1, name: 1 });

export const OfficeType = mongoose.model<IOfficeType>('OfficeType', schema, 'office_types');
