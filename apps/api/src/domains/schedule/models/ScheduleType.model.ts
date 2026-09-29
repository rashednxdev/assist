import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** Admin-managed schedule type (meeting, bill submission, …). Events store the `code`. */
export interface IScheduleType extends Document {
  code: string;
  label: string;
  label_bn?: string;
  description?: string;
  color: string;
  default_reminders: number[];
  allow_personal: boolean;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const schema = new Schema<IScheduleType>(
  {
    code: { type: String, required: true, unique: true, lowercase: true, trim: true },
    label: { type: String, required: true, trim: true },
    label_bn: { type: String },
    description: { type: String },
    color: { type: String, required: true },
    default_reminders: { type: [Number], default: [] },
    allow_personal: { type: Boolean, default: true },
    sort_order: { type: Number, default: 100 },
    is_active: { type: Boolean, default: true },
    is_system: { type: Boolean, default: false },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

export const ScheduleType = mongoose.model<IScheduleType>('ScheduleType', schema, 'schedule_types');
