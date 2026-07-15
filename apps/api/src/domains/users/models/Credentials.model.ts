import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ICredentials extends Document {
  user_id: Types.ObjectId;
  password_hash: string;
  status: 'active' | 'locked' | 'reset_required';
  failed_attempts: number;
  locked_until?: Date;
  last_login?: Date;
  last_ip?: string;
  /** First device that successfully registered/logged in (one-device policy). */
  bound_device_id?: string;
  bound_device_at?: Date;
  bound_device_label?: string;
  /** When true, user may sign in from additional devices without admin reset. */
  allow_multi_device: boolean;
  /** Bumped when admin clears the bound device to invalidate existing JWTs. */
  token_version: number;
  password_changed_at: Date;
  two_fa_enabled: boolean;
  email_otp_hash?: string;
  email_otp_expires_at?: Date;
  phone_otp_hash?: string;
  phone_otp_expires_at?: Date;
  updated_at: Date;
}

const credentialsSchema = new Schema<ICredentials>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, unique: true, ref: 'User' },
    password_hash: { type: String, required: true },
    status: {
      type: String,
      enum: ['active', 'locked', 'reset_required'],
      default: 'active',
    },
    failed_attempts: { type: Number, default: 0 },
    locked_until: { type: Date },
    last_login: { type: Date },
    last_ip: { type: String },
    bound_device_id: { type: String },
    bound_device_at: { type: Date },
    bound_device_label: { type: String },
    allow_multi_device: { type: Boolean, default: false },
    token_version: { type: Number, default: 0 },
    password_changed_at: { type: Date, required: true },
    two_fa_enabled: { type: Boolean, default: false },
    email_otp_hash: { type: String },
    email_otp_expires_at: { type: Date },
    phone_otp_hash: { type: String },
    phone_otp_expires_at: { type: Date },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' } },
);

export const Credentials = mongoose.model<ICredentials>(
  'Credentials',
  credentialsSchema,
  'credentials',
);
