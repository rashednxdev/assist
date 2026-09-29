import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { BLOOD_GROUPS, BLOOD_URGENCIES, type BloodGroup, type BloodUrgency } from '@ibas/shared-types';

export interface IBloodResponse {
  user_id: Types.ObjectId;
  note?: string;
  at: Date;
}

export interface IBloodRequest extends Document {
  requester_id: Types.ObjectId;
  patient_name?: string;
  blood_group: BloodGroup;
  units: number;
  hospital: string;
  district_id: Types.ObjectId;
  thana_id?: Types.ObjectId | null;
  address?: string;
  needed_on: Date;
  urgency: BloodUrgency;
  contact_name: string;
  contact_phone: string;
  note?: string;
  status: 'open' | 'fulfilled' | 'cancelled';
  responses: IBloodResponse[];
  notified_count: number;
  fulfilled_at?: Date | null;
  closed_by?: Types.ObjectId | null;
  created_at: Date;
  updated_at: Date;
}

const responseSchema = new Schema<IBloodResponse>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    note: { type: String, trim: true },
    at: { type: Date, required: true },
  },
  { _id: false },
);

const schema = new Schema<IBloodRequest>(
  {
    requester_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    patient_name: { type: String, trim: true },
    blood_group: { type: String, enum: BLOOD_GROUPS, required: true },
    units: { type: Number, required: true, min: 1, max: 10 },
    hospital: { type: String, required: true, trim: true },
    district_id: { type: Schema.Types.ObjectId, ref: 'District', required: true },
    thana_id: { type: Schema.Types.ObjectId, ref: 'Thana', default: null },
    address: { type: String, trim: true },
    needed_on: { type: Date, required: true },
    urgency: { type: String, enum: BLOOD_URGENCIES, default: 'normal' },
    contact_name: { type: String, required: true, trim: true },
    contact_phone: { type: String, required: true, trim: true },
    note: { type: String, trim: true },
    status: { type: String, enum: ['open', 'fulfilled', 'cancelled'], default: 'open' },
    responses: { type: [responseSchema], default: [] },
    notified_count: { type: Number, default: 0 },
    fulfilled_at: { type: Date, default: null },
    closed_by: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ status: 1, needed_on: 1 });
schema.index({ requester_id: 1, created_at: -1 });
schema.index({ 'responses.user_id': 1 });

export const BloodRequest = mongoose.model<IBloodRequest>('BloodRequest', schema, 'blood_requests');
