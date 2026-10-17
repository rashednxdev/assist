import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { SalaryOtherOfficeKind } from '@ibas/shared-types';

export interface ISalaryUserOffice extends Document {
  user_id: Types.ObjectId;
  /** Top-level office in the org directory. */
  circle_id: Types.ObjectId | null;
  /** Null when the user chose Others and typed the office name. */
  office_id: Types.ObjectId | null;
  other_office_name: string;
  other_office_name_bn: string;
  /** For Others: gob | autonomous; null for listed offices. */
  other_office_kind: SalaryOtherOfficeKind | null;
  /** Admin lets this user edit the office name printed on the bill forms. */
  office_name_editable: boolean;
  /** Bill-passing office (CAFO, DCA, DAFO or UAO) chosen by users of other offices. */
  accounting_office_id: Types.ObjectId | null;
  /** Admin made this user a contact for the offices whose bills their listed office passes. */
  office_admin: boolean;
  updated_at: Date;
}

const schema = new Schema<ISalaryUserOffice>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    circle_id: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    office_id: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    other_office_name: { type: String, default: '' },
    other_office_name_bn: { type: String, default: '' },
    other_office_kind: { type: String, enum: ['gob', 'autonomous'], default: null },
    office_name_editable: { type: Boolean, default: false },
    accounting_office_id: { type: Schema.Types.ObjectId, ref: 'Office', default: null },
    office_admin: { type: Boolean, default: false },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ office_id: 1, _id: 1 });
schema.index({ office_id: 1, office_admin: 1 });

export const SalaryUserOffice = mongoose.model<ISalaryUserOffice>('SalaryUserOffice', schema, 'salary_user_offices');
