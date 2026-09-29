import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { AccessPackageKind } from '@ibas/shared-constants';

export interface IAccessPackage extends Document {
  kind: AccessPackageKind;
  name: string;
  name_bn?: string;
  description?: string;
  exam_subject_id?: Types.ObjectId | null;
  duration_days: number;
  price: number;
  compare_at_price?: number | null;
  features: string[];
  is_featured: boolean;
  sort_order: number;
  is_active: boolean;
  /** Soft-deleted packages stay for order history but are hidden everywhere else. */
  is_deleted: boolean;
  created_by?: Types.ObjectId;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IAccessPackage>(
  {
    kind: { type: String, enum: ['exam_prep', 'basic', 'live'], required: true },
    name: { type: String, required: true, trim: true },
    name_bn: { type: String, trim: true },
    description: { type: String, trim: true },
    exam_subject_id: { type: Schema.Types.ObjectId, ref: 'ExamSubject', default: null },
    duration_days: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    compare_at_price: { type: Number, default: null },
    features: { type: [String], default: [] },
    is_featured: { type: Boolean, default: false },
    sort_order: { type: Number, default: 100 },
    is_active: { type: Boolean, default: true },
    is_deleted: { type: Boolean, default: false },
    created_by: { type: Schema.Types.ObjectId, ref: 'User' },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ kind: 1, is_deleted: 1, sort_order: 1 });

export const AccessPackage = mongoose.model<IAccessPackage>('AccessPackage', schema, 'access_packages');
