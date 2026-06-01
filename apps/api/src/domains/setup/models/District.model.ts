import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IDistrict extends Document {
  division_id: Types.ObjectId;
  name_en: string;
  name_bn?: string;
  short_code: string;
  is_active: boolean;
}

const schema = new Schema<IDistrict>(
  {
    division_id: { type: Schema.Types.ObjectId, ref: 'Division', required: true },
    name_en: { type: String, required: true },
    name_bn: { type: String },
    short_code: { type: String, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ division_id: 1, is_active: 1 });

export const District = mongoose.model<IDistrict>('District', schema, 'districts');
