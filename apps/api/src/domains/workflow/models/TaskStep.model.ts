import mongoose, { Schema, type Document, type Types } from 'mongoose';

export interface StepField {
  name: string;
  label: string;
  label_bn?: string;
  type: 'text' | 'number' | 'select' | 'date' | 'otp' | 'file';
  required: boolean;
  placeholder?: string;
  placeholder_bn?: string;
  validation?: string;
  hint?: string;
  hint_bn?: string;
  sort_order: number;
  options?: string[];
  options_bn?: string[];
}

export interface ITaskStep extends Document {
  task_id: Types.ObjectId;
  step_number: number;
  title_en: string;
  title_bn?: string;
  description_en: string;
  description_bn?: string;
  role_id: Types.ObjectId;
  role_code: string;
  role_name_en: string;
  fields: StepField[];
  condition_text?: string;
  handoff_msg?: string;
  handoff_role?: string;
  is_optional: boolean;
  is_auto: boolean;
  nav_menu_path?: string;
  sort_order: number;
  version: number;
  created_at: Date;
  updated_at: Date;
}

const fieldSchema = new Schema<StepField>(
  {
    name: { type: String, required: true },
    label: { type: String, required: true },
    label_bn: { type: String },
    type: { type: String, enum: ['text', 'number', 'select', 'date', 'otp', 'file'], required: true },
    required: { type: Boolean, default: false },
    placeholder: { type: String },
    placeholder_bn: { type: String },
    validation: { type: String },
    hint: { type: String },
    hint_bn: { type: String },
    sort_order: { type: Number, required: true },
    options: { type: [String] },
    options_bn: { type: [String] },
  },
  { _id: false },
);

const schema = new Schema<ITaskStep>(
  {
    task_id: { type: Schema.Types.ObjectId, required: true, ref: 'Task' },
    step_number: { type: Number, required: true },
    title_en: { type: String, required: true },
    title_bn: { type: String },
    description_en: { type: String, required: true },
    description_bn: { type: String },
    role_id: { type: Schema.Types.ObjectId, required: true },
    role_code: { type: String, required: true },
    role_name_en: { type: String, required: true },
    fields: { type: [fieldSchema], default: [] },
    condition_text: { type: String },
    handoff_msg: { type: String },
    handoff_role: { type: String },
    is_optional: { type: Boolean, default: false },
    is_auto: { type: Boolean, default: false },
    nav_menu_path: { type: String },
    sort_order: { type: Number, required: true },
    version: { type: Number, default: 1 },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ task_id: 1, step_number: 1 }, { unique: true });
schema.index({ task_id: 1, role_code: 1 });

export const TaskStep = mongoose.model<ITaskStep>('TaskStep', schema, 'task_steps');
