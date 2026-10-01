import mongoose, { Schema, type Document } from 'mongoose';
import { DEDUCTION_SETUP_KINDS, type DeductionSetupKind } from '@ibas/shared-types';

export interface IDeductionSetup extends Document {
  kind: DeductionSetupKind;
  code?: string;
  name_en: string;
  name_bn?: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IDeductionSetup>(
  {
    kind: { type: String, enum: DEDUCTION_SETUP_KINDS, required: true },
    code: { type: String, trim: true },
    name_en: { type: String, default: '', trim: true },
    name_bn: { type: String, trim: true },
    description: String,
    sort_order: { type: Number, default: 0 },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ kind: 1, is_active: 1, sort_order: 1 });

export const DeductionSetup = mongoose.model<IDeductionSetup>('DeductionSetup', schema, 'deduction_setup');
