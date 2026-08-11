import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { UserType } from '@ibas/shared-constants';

export interface WorkflowRoleTag {
  role_id: Types.ObjectId;
  role_code: string;
  is_active: boolean;
  assigned_at: Date;
  assigned_by: Types.ObjectId;
}

export interface IUser extends Document {
  employee_id?: string;
  nid?: string;
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone: string;
  dob?: Date;
  gender?: 'male' | 'female' | 'other';
  profile_photo?: string;
  user_type: UserType;
  workflow_roles: WorkflowRoleTag[];
  status: 'active' | 'inactive' | 'suspended' | 'pending_verify';
  is_verified: boolean;
  email_verified: boolean;
  phone_verified: boolean;
  is_super_admin: boolean;
  /** Admin-only accounting field — not exposed on /auth/me. */
  amount_received: number;
  created_by: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const workflowRoleTagSchema = new Schema<WorkflowRoleTag>(
  {
    role_id: { type: Schema.Types.ObjectId, required: true },
    role_code: { type: String, required: true },
    is_active: { type: Boolean, default: true },
    assigned_at: { type: Date, required: true },
    assigned_by: { type: Schema.Types.ObjectId, required: true },
  },
  { _id: false },
);

const userSchema = new Schema<IUser>(
  {
    employee_id: { type: String, sparse: true, unique: true },
    nid: { type: String, sparse: true, unique: true },
    full_name_en: { type: String, required: true },
    full_name_bn: { type: String },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true, unique: true },
    dob: { type: Date },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    profile_photo: { type: String },
    user_type: {
      type: String,
      enum: ['system_admin', 'admin', 'applicant', 'officer'],
      required: true,
    },
    workflow_roles: { type: [workflowRoleTagSchema], default: [] },
    status: {
      type: String,
      enum: ['active', 'inactive', 'suspended', 'pending_verify'],
      default: 'active',
    },
    is_verified: { type: Boolean, default: false },
    email_verified: { type: Boolean, default: false },
    phone_verified: { type: Boolean, default: false },
    is_super_admin: { type: Boolean, default: false },
    amount_received: { type: Number, default: 0, min: 0 },
    created_by: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

userSchema.index({ user_type: 1, status: 1 });
userSchema.index({ 'workflow_roles.role_code': 1, status: 1 });

export const User = mongoose.model<IUser>('User', userSchema, 'users');
