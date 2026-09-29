import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { BillingChargeType } from '@ibas/shared-types';

export interface IBillingSettings extends Document {
  key: 'global';
  charge_type: BillingChargeType;
  charge_value: number;
  charge_label: string;
  checkout_note?: string;
  gateway_enabled: boolean;
  updated_by?: Types.ObjectId;
  updated_at: Date;
}

const schema = new Schema<IBillingSettings>(
  {
    key: { type: String, default: 'global', unique: true },
    charge_type: { type: String, enum: ['none', 'percent', 'fixed'], default: 'percent' },
    charge_value: { type: Number, default: 0 },
    charge_label: { type: String, default: 'Payment charge' },
    checkout_note: { type: String },
    gateway_enabled: { type: Boolean, default: true },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' } },
);

export const BillingSettings = mongoose.model<IBillingSettings>('BillingSettings', schema, 'billing_settings');
