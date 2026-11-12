import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ILiveHost extends Document {
  user_id: Types.ObjectId;
  display_name: string;
  bio?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ILiveHost>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User', unique: true },
    display_name: { type: String, required: true, trim: true },
    bio: { type: String, trim: true },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ is_active: 1, display_name: 1 });

export const LiveHost = mongoose.model<ILiveHost>('LiveHost', schema, 'live_hosts');
