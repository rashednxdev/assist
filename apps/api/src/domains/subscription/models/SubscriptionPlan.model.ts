import mongoose, { Schema, type Document } from 'mongoose';

export interface ISubscriptionPlan extends Document {
  name: string;
  code: string;
  description?: string;
  price_bdt: number;
  duration_days: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
}

const schema = new Schema<ISubscriptionPlan>(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: { type: String },
    price_bdt: { type: Number, required: true },
    duration_days: { type: Number, required: true },
    features: { type: [String], default: [] },
    is_active: { type: Boolean, default: true },
    sort_order: { type: Number, default: 1 },
  },
  { timestamps: false },
);

export const SubscriptionPlan = mongoose.model<ISubscriptionPlan>(
  'SubscriptionPlan',
  schema,
  'subscription_plans',
);
