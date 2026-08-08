import mongoose, { Schema, type Document } from 'mongoose';

export interface IModule extends Document {
  name_en: string;
  name_bn?: string;
  code: string;
  description_en: string;
  description_bn?: string;
  icon?: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  /** Admin-authored note shown to students when is_active is false (a global stop, not a
   * per-user access denial) — explains why without them needing to ask. */
  stopped_reason?: string;
  created_at: Date;
}

const schema = new Schema<IModule>(
  {
    name_en: { type: String, required: true },
    name_bn: { type: String },
    code: { type: String, required: true, unique: true },
    description_en: { type: String, required: true },
    description_bn: { type: String },
    icon: { type: String },
    color: { type: String, required: true },
    sort_order: { type: Number, required: true },
    is_active: { type: Boolean, default: true },
    stopped_reason: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

export const Module = mongoose.model<IModule>('Module', schema, 'modules');
