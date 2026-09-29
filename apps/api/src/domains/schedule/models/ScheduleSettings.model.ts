import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** Single `key: 'global'` document with admin-editable schedule rules. */
export interface IScheduleSettings extends Document {
  key: 'global';
  rr_cycle_years: number;
  rr_days: number;
  rr_count_from: 'leave_start' | 'leave_end';
  rr_reminder_days: number[];
  reminder_time: string;
  updated_by?: Types.ObjectId;
  updated_at: Date;
}

const schema = new Schema<IScheduleSettings>(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    rr_cycle_years: { type: Number },
    rr_days: { type: Number },
    rr_count_from: { type: String, enum: ['leave_start', 'leave_end'] },
    rr_reminder_days: { type: [Number] },
    reminder_time: { type: String },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' } },
);

export const ScheduleSettings = mongoose.model<IScheduleSettings>('ScheduleSettings', schema, 'schedule_settings');
