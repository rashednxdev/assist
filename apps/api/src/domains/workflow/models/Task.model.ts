import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface ITask extends Document {
  name_en: string;
  name_bn?: string;
  code: string;
  module_id: Types.ObjectId;
  module_code: string;
  module_name_en: string;
  description_en: string;
  description_bn?: string;
  roles_involved: string[];
  total_steps: number;
  estimated_time?: number;
  is_active: boolean;
  is_published: boolean;
  version: number;
  tags: string[];
  created_by: Types.ObjectId;
  updated_by?: Types.ObjectId;
  run_count: number;
  avg_duration_ms?: number;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<ITask>(
  {
    name_en: { type: String, required: true },
    name_bn: { type: String },
    code: { type: String, required: true, unique: true },
    module_id: { type: Schema.Types.ObjectId, required: true },
    module_code: { type: String, required: true },
    module_name_en: { type: String, required: true },
    description_en: { type: String, required: true },
    description_bn: { type: String },
    roles_involved: { type: [String], default: [] },
    total_steps: { type: Number, default: 0 },
    estimated_time: { type: Number },
    is_active: { type: Boolean, default: true },
    is_published: { type: Boolean, default: false },
    version: { type: Number, default: 1 },
    tags: { type: [String], default: [] },
    created_by: { type: Schema.Types.ObjectId, required: true },
    updated_by: { type: Schema.Types.ObjectId },
    run_count: { type: Number, default: 0 },
    avg_duration_ms: { type: Number },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ module_id: 1, is_active: 1, is_published: 1 });

export const Task = mongoose.model<ITask>('Task', schema, 'tasks');
