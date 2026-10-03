import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { AccessPackageKind } from '@ibas/shared-constants';

/** Time-boxed access bought through a package (one row per paid order). */
export interface IUserEntitlement extends Document {
  user_id: Types.ObjectId;
  kind: AccessPackageKind;
  package_id: Types.ObjectId;
  package_name: string;
  /**
   * Exam Preparation scope. Set on every grant made since parts were introduced: with a subject it
   * opens that subject, without one the whole part. Older grants have no part and open all of Part 1.
   */
  exam_part_id?: Types.ObjectId | null;
  exam_part_name?: string;
  exam_subject_id?: Types.ObjectId | null;
  exam_subject_name?: string;
  order_id?: Types.ObjectId;
  starts_at: Date;
  ends_at: Date;
  is_revoked: boolean;
  revoked_note?: string;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IUserEntitlement>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    kind: { type: String, enum: ['exam_prep', 'basic', 'live'], required: true },
    package_id: { type: Schema.Types.ObjectId, ref: 'AccessPackage', required: true },
    package_name: { type: String, required: true },
    exam_part_id: { type: Schema.Types.ObjectId, ref: 'ExamPart' },
    exam_part_name: { type: String },
    exam_subject_id: { type: Schema.Types.ObjectId, ref: 'ExamSubject', default: null },
    exam_subject_name: { type: String },
    order_id: { type: Schema.Types.ObjectId, ref: 'PaymentOrder' },
    starts_at: { type: Date, required: true },
    ends_at: { type: Date, required: true },
    is_revoked: { type: Boolean, default: false },
    revoked_note: { type: String },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ user_id: 1, ends_at: -1 });
schema.index({ order_id: 1 }, { unique: true, sparse: true });

export const UserEntitlement = mongoose.model<IUserEntitlement>('UserEntitlement', schema, 'user_entitlements');
