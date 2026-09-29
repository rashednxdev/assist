import mongoose, { Schema, type Document } from 'mongoose';

/**
 * One row per reminder already sent. The unique `key` is claimed before sending, so a reminder
 * goes out once even if ticks overlap or several API instances run.
 */
export interface IScheduleDispatch extends Document {
  key: string;
  recipients: number;
  created_at: Date;
}

const schema = new Schema<IScheduleDispatch>(
  {
    key: { type: String, required: true, unique: true },
    recipients: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 400 },
  },
  { timestamps: false },
);

export const ScheduleDispatch = mongoose.model<IScheduleDispatch>('ScheduleDispatch', schema, 'schedule_dispatches');
