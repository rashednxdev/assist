import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IUserSubscription extends Document {
  user_id: Types.ObjectId;
  plan_id: Types.ObjectId;
  status: 'active' | 'expired' | 'cancelled';
  started_at: Date;
  expires_at: Date;
  created_at: Date;
}

const schema = new Schema<IUserSubscription>(
  {
    user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    plan_id: { type: Schema.Types.ObjectId, required: true, ref: 'SubscriptionPlan' },
    status: { type: String, enum: ['active', 'expired', 'cancelled'], default: 'active' },
    started_at: { type: Date, required: true },
    expires_at: { type: Date, required: true },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false },
);

schema.index({ user_id: 1, status: 1 });

export const UserSubscription = mongoose.model<IUserSubscription>(
  'UserSubscription',
  schema,
  'user_subscriptions',
);
