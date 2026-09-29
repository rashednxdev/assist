import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ICommunityCategory extends Document {
  code: string;
  name: string;
  name_bn?: string;
  description?: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ICommunityCategory>(
  {
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true, trim: true },
    name_bn: { type: String, trim: true },
    description: { type: String },
    color: { type: String, default: '#0f766e' },
    sort_order: { type: Number, default: 100 },
    is_active: { type: Boolean, default: true },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const CommunityCategory = mongoose.model<ICommunityCategory>('CommunityCategory', schema, 'community_categories');
