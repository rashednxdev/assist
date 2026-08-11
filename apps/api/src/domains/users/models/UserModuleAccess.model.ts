import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface IUserModuleAccess extends Document {
  user_id: Types.ObjectId;
  module_id: Types.ObjectId;
  module_code: string;
  permissions: string[];
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_grade: boolean;
  can_publish: boolean;
  /** Keep access for this user while the module is centrally stopped. */
  bypass_stop: boolean;
  task_restrictions: string[];
  granted_by: Types.ObjectId;
  granted_at: Date;
  expires_at?: Date;
  is_active: boolean;
}

const schema = new Schema<IUserModuleAccess>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    module_id: { type: Schema.Types.ObjectId, ref: 'Module', required: true },
    module_code: { type: String, required: true },
    permissions: { type: [String], default: [] },
    can_read: { type: Boolean, default: true },
    can_create: { type: Boolean, default: false },
    can_update: { type: Boolean, default: false },
    can_delete: { type: Boolean, default: false },
    can_grade: { type: Boolean, default: false },
    can_publish: { type: Boolean, default: false },
    bypass_stop: { type: Boolean, default: false },
    task_restrictions: { type: [String], default: [] },
    granted_by: { type: Schema.Types.ObjectId, required: true },
    granted_at: { type: Date, default: Date.now },
    expires_at: { type: Date },
    is_active: { type: Boolean, default: true },
  },
  { timestamps: false },
);

schema.index({ user_id: 1, module_id: 1 }, { unique: true });
schema.index({ user_id: 1, is_active: 1 });

export const UserModuleAccess = mongoose.model<IUserModuleAccess>(
  'UserModuleAccess',
  schema,
  'user_module_access',
);
