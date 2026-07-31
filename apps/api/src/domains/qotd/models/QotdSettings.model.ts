import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IQotdSettings extends Document {
  key: 'global';
  show_past_days: number;
  updated_by?: Types.ObjectId;
  updated_at: Date;
}

const schema = new Schema<IQotdSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    show_past_days: { type: Number, required: true, default: 7 },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

export const QotdSettings = mongoose.model<IQotdSettings>('QotdSettings', schema, 'qotd_settings');
