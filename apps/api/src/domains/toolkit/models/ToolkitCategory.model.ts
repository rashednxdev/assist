import mongoose, { Schema, type Document } from 'mongoose';
import { TOOLKIT_KIND_CODES, type ToolkitKind } from '@ibas/shared-constants';

export interface IToolkitCategory extends Document {
  code: string;
  label: string;
  kinds: ToolkitKind[];
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IToolkitCategory>(
  {
    code: { type: String, required: true, trim: true, unique: true },
    label: { type: String, required: true, trim: true },
    kinds: { type: [{ type: String, enum: TOOLKIT_KIND_CODES }], default: [] },
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const ToolkitCategory = mongoose.model<IToolkitCategory>('ToolkitCategory', schema, 'toolkit_categories');
