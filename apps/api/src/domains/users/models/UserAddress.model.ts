import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IUserAddress extends Document {
  user_id: Types.ObjectId;
  address_type: 'permanent' | 'present' | 'office';
  division_id: Types.ObjectId;
  district_id: Types.ObjectId;
  thana_id: Types.ObjectId;
  village_or_area?: string;
  post_code?: string;
  full_address?: string;
  is_primary: boolean;
  created_at: Date;
}

const schema = new Schema<IUserAddress>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    address_type: { type: String, enum: ['permanent', 'present', 'office'], required: true },
    division_id: { type: Schema.Types.ObjectId, ref: 'Division', required: true },
    district_id: { type: Schema.Types.ObjectId, ref: 'District', required: true },
    thana_id: { type: Schema.Types.ObjectId, ref: 'Thana', required: true },
    village_or_area: { type: String },
    post_code: { type: String },
    full_address: { type: String },
    is_primary: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: false } },
);

schema.index({ user_id: 1 });

export const UserAddress = mongoose.model<IUserAddress>('UserAddress', schema, 'user_addresses');
