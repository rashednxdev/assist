import mongoose, { Schema, type Document } from 'mongoose';

export interface IRole extends Document {
  name_en: string;
  name_bn?: string;
  code: string;
  description_en: string;
  description_bn?: string;
  color: string;
  level: number;
  permissions: string[];
  modules: string[];
  can_approve: boolean;
  can_submit: boolean;
  can_forward: boolean;
  is_system: boolean;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IRole>(
  {
    name_en: { type: String, required: true },
    name_bn: { type: String },
    code: { type: String, required: true, unique: true },
    description_en: { type: String, required: true },
    description_bn: { type: String },
    color: { type: String, required: true },
    level: { type: Number, required: true },
    permissions: { type: [String], default: [] },
    modules: { type: [String], default: [] },
    can_approve: { type: Boolean, default: false },
    can_submit: { type: Boolean, default: false },
    can_forward: { type: Boolean, default: false },
    is_system: { type: Boolean, default: false },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const Role = mongoose.model<IRole>('Role', schema, 'roles');
