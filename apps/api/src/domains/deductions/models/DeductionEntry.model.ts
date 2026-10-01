import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { DEDUCTION_AMOUNT_MODES, type DeductionAmountMode } from '@ibas/shared-types';

export interface IDeductionLine {
  deduction_type_id: Types.ObjectId;
  mode: DeductionAmountMode;
  value?: number;
  text?: string;
  note?: string;
}

export interface IDeductionEntry extends Document {
  economic_code_id: Types.ObjectId;
  bill_type_id: Types.ObjectId;
  title?: string;
  details?: string;
  deductions: IDeductionLine[];
  highlights: string[];
  source?: string;
  process_ids: Types.ObjectId[];
  circular_ids: Types.ObjectId[];
  is_published: boolean;
  is_active: boolean;
  created_by: Types.ObjectId;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const lineSchema = new Schema<IDeductionLine>(
  {
    deduction_type_id: { type: Schema.Types.ObjectId, required: true, ref: 'DeductionSetup' },
    mode: { type: String, enum: DEDUCTION_AMOUNT_MODES, required: true },
    value: Number,
    text: String,
    note: String,
  },
  { _id: false },
);

const schema = new Schema<IDeductionEntry>(
  {
    economic_code_id: { type: Schema.Types.ObjectId, required: true, ref: 'DeductionSetup' },
    bill_type_id: { type: Schema.Types.ObjectId, required: true, ref: 'DeductionSetup' },
    title: { type: String, trim: true },
    details: String,
    deductions: { type: [lineSchema], default: [] },
    highlights: { type: [String], default: [] },
    source: String,
    process_ids: { type: [Schema.Types.ObjectId], default: [] },
    circular_ids: { type: [Schema.Types.ObjectId], default: [] },
    is_published: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ is_active: 1, is_published: 1, economic_code_id: 1, bill_type_id: 1 });
schema.index({ circular_ids: 1 });

export const DeductionEntry = mongoose.model<IDeductionEntry>('DeductionEntry', schema, 'deduction_entries');
