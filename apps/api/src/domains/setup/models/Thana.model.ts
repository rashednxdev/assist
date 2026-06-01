import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IThana extends Document {
  district_id: Types.ObjectId;
  name_en: string;
  name_bn?: string;
  short_code: string;
  is_active: boolean;
}

const schema = new Schema<IThana>(
  {
    district_id: { type: Schema.Types.ObjectId, ref: 'District', required: true },
    name_en: { type: String, required: true },
    name_bn: { type: String },
    short_code: { type: String, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ district_id: 1, is_active: 1 });

export const Thana = mongoose.model<IThana>('Thana', schema, 'thanas');
