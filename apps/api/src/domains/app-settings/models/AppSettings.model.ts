import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IAppSettings extends Document {
  key: 'global';
  unpaid_message: string;
  updated_by?: Types.ObjectId;
  updated_at: Date;
}

const schema = new Schema<IAppSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    unpaid_message: { type: String, required: true, default: '' },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const AppSettings = mongoose.model<IAppSettings>('AppSettings', schema, 'app_settings');
