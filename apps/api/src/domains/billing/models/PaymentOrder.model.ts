import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { AccessPackageKind } from '@ibas/shared-constants';
import type { OrderStatus, PaymentMethod } from '@ibas/shared-types';

export interface IPaymentOrder extends Document {
  invoice_no: string;
  user_id: Types.ObjectId;
  package_id: Types.ObjectId;
  /** Snapshot so history stays correct after the admin edits or removes the package. */
  kind: AccessPackageKind;
  package_name: string;
  exam_subject_id?: Types.ObjectId | null;
  exam_subject_name?: string;
  duration_days: number;
  price: number;
  charge: number;
  charge_label: string;
  total: number;
  currency: 'BDT';
  method: PaymentMethod;
  status: OrderStatus;
  failure_reason?: string;
  /** Masked wallet number, e.g. 017•••••678. */
  payer_account?: string;
  trx_id?: string;
  gateway_payment_id?: string;
  note?: string;
  recorded_by?: Types.ObjectId;
  access_starts_at?: Date;
  access_ends_at?: Date;
  /** Pending orders lapse after this. */
  expires_at?: Date;
  paid_at?: Date;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IPaymentOrder>(
  {
    invoice_no: { type: String, required: true, unique: true },
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    package_id: { type: Schema.Types.ObjectId, ref: 'AccessPackage', required: true },
    kind: { type: String, enum: ['exam_prep', 'basic', 'live'], required: true },
    package_name: { type: String, required: true },
    exam_subject_id: { type: Schema.Types.ObjectId, ref: 'ExamSubject', default: null },
    exam_subject_name: { type: String },
    duration_days: { type: Number, required: true },
    price: { type: Number, required: true },
    charge: { type: Number, default: 0 },
    charge_label: { type: String, default: 'Charge' },
    total: { type: Number, required: true },
    currency: { type: String, default: 'BDT' },
    method: { type: String, enum: ['bkash_demo', 'manual', 'free'], required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'cancelled', 'expired'], default: 'pending' },
    failure_reason: { type: String },
    payer_account: { type: String },
    trx_id: { type: String },
    gateway_payment_id: { type: String },
    note: { type: String, trim: true },
    recorded_by: { type: Schema.Types.ObjectId, ref: 'User' },
    access_starts_at: { type: Date },
    access_ends_at: { type: Date },
    expires_at: { type: Date },
    paid_at: { type: Date },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ user_id: 1, created_at: -1 });
schema.index({ status: 1, created_at: -1 });
schema.index({ package_id: 1, status: 1 });
schema.index({ trx_id: 1 }, { sparse: true });

export const PaymentOrder = mongoose.model<IPaymentOrder>('PaymentOrder', schema, 'payment_orders');
