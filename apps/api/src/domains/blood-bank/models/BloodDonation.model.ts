import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IBloodDonation extends Document {
  user_id: Types.ObjectId;
  donated_on: Date;
  next_eligible_on: Date;
  place?: string;
  note?: string;
  request_id?: Types.ObjectId | null;
  created_at: Date;
}

const schema = new Schema<IBloodDonation>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    donated_on: { type: Date, required: true },
    next_eligible_on: { type: Date, required: true },
    place: { type: String, trim: true },
    note: { type: String, trim: true },
    request_id: { type: Schema.Types.ObjectId, ref: 'BloodRequest', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

schema.index({ user_id: 1, donated_on: -1 });
schema.index({ donated_on: -1 });

export const BloodDonation = mongoose.model<IBloodDonation>('BloodDonation', schema, 'blood_donations');
