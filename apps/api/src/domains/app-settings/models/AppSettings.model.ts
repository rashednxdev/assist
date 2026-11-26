import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAppSettings extends Document {
  key: 'global';
  unpaid_message: string;
  /** Full mobile label e.g. ProAssist.2.1.0.0 — first two segments drive force-update. */
  mobile_latest_version?: string | null;
  mobile_update_url?: string | null;
  mobile_force_message?: string | null;
  /** Set once existing office + designation holders were marked verified for contacts. */
  contact_verification_seeded_at?: Date | null;
  updated_by?: Types.ObjectId;
  updated_at: Date;
}

const schema = new Schema<IAppSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    unpaid_message: { type: String, required: true, default: '' },
    mobile_latest_version: { type: String, default: null },
    mobile_update_url: { type: String, default: null },
    mobile_force_message: { type: String, default: null },
    contact_verification_seeded_at: { type: Date, default: null },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const AppSettings = mongoose.model<IAppSettings>('AppSettings', schema, 'app_settings');
