import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { ContactVerificationStatus } from '@ibas/shared-types';

/** Posting + grade copied at verification time, so the audit trail survives later transfers. */
export interface IVerificationSnapshot {
  office_name?: string;
  designation_name?: string;
  grade?: number | null;
}

export interface IContactVerification extends Document {
  user_id: Types.ObjectId;
  status: ContactVerificationStatus;
  /** 8-digit code while pending; cleared once verified. */
  code?: string | null;
  code_issued_at?: Date | null;
  verified_by?: Types.ObjectId | null;
  verified_at?: Date | null;
  verifier_snapshot?: IVerificationSnapshot | null;
  subject_snapshot?: IVerificationSnapshot | null;
  created_at: Date;
  updated_at: Date;
}

const snapshot = new Schema<IVerificationSnapshot>(
  { office_name: String, designation_name: String, grade: { type: Number, default: null } },
  { _id: false },
);

const schema = new Schema<IContactVerification>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: ['pending', 'verified', 'legacy'], required: true, default: 'pending' },
    code: { type: String, default: null },
    code_issued_at: { type: Date, default: null },
    verified_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    verified_at: { type: Date, default: null },
    verifier_snapshot: { type: snapshot, default: null },
    subject_snapshot: { type: snapshot, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ user_id: 1 }, { unique: true });
schema.index({ code: 1 }, { unique: true, partialFilterExpression: { code: { $type: 'string' } } });
schema.index({ verified_by: 1, verified_at: -1 });
schema.index({ status: 1, updated_at: -1 });

export const ContactVerification = mongoose.model<IContactVerification>('ContactVerification', schema, 'contact_verifications');
