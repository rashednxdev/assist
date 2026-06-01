import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IRegulationAmendment extends Document {
  regulation_id: Types.ObjectId;
  amendment_no: string;
  amendment_date: Date;
  issued_by: string;
  circular_ref?: string;
  old_text?: string;
  new_text: string;
  change_summary: string;
  is_active: boolean;
  created_at: Date;
}

const schema = new Schema<IRegulationAmendment>(
  {
    regulation_id: { type: Schema.Types.ObjectId, required: true, ref: 'Regulation' },
    amendment_no: { type: String, required: true },
    amendment_date: { type: Date, required: true },
    issued_by: { type: String, required: true },
    circular_ref: { type: String },
    old_text: { type: String },
    new_text: { type: String, required: true },
    change_summary: { type: String, required: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

schema.index({ regulation_id: 1, amendment_date: -1 });

export const RegulationAmendment = mongoose.model<IRegulationAmendment>(
  'RegulationAmendment',
  schema,
  'regulation_amendments',
);
