import mongoose, { Schema, type Document, type Types } from 'mongoose';

/** Per-user service dates used for rest & recreation leave reminders. */
export interface IScheduleProfile extends Document {
  user_id: Types.ObjectId;
  joining_date?: string;
  rr_history: Array<{ start_date: string; end_date?: string; note?: string }>;
  rr_reminders: boolean;
  updated_at: Date;
}

const schema = new Schema<IScheduleProfile>(
  {
    user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    joining_date: { type: String },
    rr_history: {
      type: [new Schema({ start_date: String, end_date: String, note: String }, { _id: false })],
      default: [],
    },
    rr_reminders: { type: Boolean, default: true },
  },
  { timestamps: { createdAt: false, updatedAt: 'updated_at' } },
);

export const ScheduleProfile = mongoose.model<IScheduleProfile>('ScheduleProfile', schema, 'schedule_profiles');
