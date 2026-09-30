import mongoose, { Schema, type Document, type Types } from 'mongoose';
import { SCHEDULE_TARGET_TYPES, type ScheduleKind, type ScheduleLinkType, type ScheduleRecurrence, type ScheduleTargetType } from '@ibas/shared-types';

export interface IScheduleOverride {
  date: string;
  new_date?: string;
  new_time?: string;
  cancelled?: boolean;
  note?: string;
}

export interface IScheduleChange {
  action: 'updated' | 'postponed' | 'cancelled' | 'restored';
  note?: string;
  occurrence_date?: string;
  from?: { date: string; time?: string };
  to?: { date: string; time?: string };
  by: Types.ObjectId;
  at: Date;
}

export interface IScheduleAttachment {
  id: string;
  name: string;
  size: number;
  stored_name: string;
  uploaded_at: Date;
}

/**
 * A schedule item. `universal` items are created by admins and shown to all (or picked) users;
 * `personal` items belong to one user. Dates/times are Bangladesh wall-clock values.
 */
export interface IScheduleEvent extends Document {
  scope: 'universal' | 'personal';
  owner_id?: Types.ObjectId;
  kind: ScheduleKind;
  title: string;
  description?: string;
  location?: string;
  meeting_link?: string;
  date: string;
  time?: string;
  end_time?: string;
  end_date?: string;
  recurrence: ScheduleRecurrence;
  reminders: number[];
  target_type: ScheduleTargetType;
  target_user_ids: Types.ObjectId[];
  target_office_type_ids: Types.ObjectId[];
  /** For 'office_tree' each office also covers every office below it. */
  target_office_ids: Types.ObjectId[];
  /** Blank lower levels cover the whole area above them. */
  target_location?: { division_id?: Types.ObjectId | null; district_id?: Types.ObjectId | null; thana_id?: Types.ObjectId | null };
  attachments: IScheduleAttachment[];
  links: Array<{ type: ScheduleLinkType; id: Types.ObjectId }>;
  is_published: boolean;
  /** false = deleted (hidden). */
  is_active: boolean;
  /** 'cancelled' = called off by the admin but still shown to users with the note. */
  status: 'active' | 'cancelled';
  cancel_note?: string;
  postponed_from?: { date: string; time?: string };
  /** Per-occurrence postponements / cancellations for repeating schedules. */
  overrides: IScheduleOverride[];
  change_log: IScheduleChange[];
  created_by: Types.ObjectId;
  updated_by?: Types.ObjectId;
  created_at: Date;
  updated_at: Date;
}

const attachmentSchema = new Schema<IScheduleAttachment>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    size: { type: Number, required: true },
    stored_name: { type: String, required: true },
    uploaded_at: { type: Date, default: Date.now },
  },
  { _id: false },
);

const recurrenceSchema = new Schema(
  {
    freq: { type: String, enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'], default: 'none' },
    interval: { type: Number, default: 1 },
    weekdays: { type: [Number], default: [] },
    month_day: { type: Number },
    until: { type: String },
    weekend_shift: { type: String, enum: ['none', 'before', 'after'], default: 'none' },
  },
  { _id: false },
);

const schema = new Schema<IScheduleEvent>(
  {
    scope: { type: String, enum: ['universal', 'personal'], required: true },
    owner_id: { type: Schema.Types.ObjectId, ref: 'User' },
    kind: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String },
    location: { type: String },
    meeting_link: { type: String },
    date: { type: String, required: true },
    time: { type: String },
    end_time: { type: String },
    end_date: { type: String },
    recurrence: { type: recurrenceSchema, default: () => ({}) },
    reminders: { type: [Number], default: [] },
    target_type: { type: String, enum: SCHEDULE_TARGET_TYPES, default: 'all' },
    target_user_ids: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    target_office_type_ids: [{ type: Schema.Types.ObjectId, ref: 'OfficeType' }],
    target_office_ids: [{ type: Schema.Types.ObjectId, ref: 'Office' }],
    target_location: {
      type: new Schema(
        {
          division_id: { type: Schema.Types.ObjectId, ref: 'Division', default: null },
          district_id: { type: Schema.Types.ObjectId, ref: 'District', default: null },
          thana_id: { type: Schema.Types.ObjectId, ref: 'Thana', default: null },
        },
        { _id: false },
      ),
    },
    attachments: { type: [attachmentSchema], default: [] },
    links: {
      type: [new Schema({ type: { type: String, enum: ['task', 'toolkit'] }, id: Schema.Types.ObjectId }, { _id: false })],
      default: [],
    },
    is_published: { type: Boolean, default: true },
    is_active: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'cancelled'], default: 'active' },
    cancel_note: { type: String },
    postponed_from: { type: new Schema({ date: String, time: String }, { _id: false }) },
    overrides: {
      type: [
        new Schema(
          { date: { type: String, required: true }, new_date: String, new_time: String, cancelled: Boolean, note: String },
          { _id: false },
        ),
      ],
      default: [],
    },
    change_log: {
      type: [
        new Schema(
          {
            action: { type: String, enum: ['updated', 'postponed', 'cancelled', 'restored'], required: true },
            note: String,
            occurrence_date: String,
            from: { type: new Schema({ date: String, time: String }, { _id: false }) },
            to: { type: new Schema({ date: String, time: String }, { _id: false }) },
            by: { type: Schema.Types.ObjectId, ref: 'User' },
            at: { type: Date, default: Date.now },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    created_by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    updated_by: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ scope: 1, is_active: 1, date: 1 });
schema.index({ owner_id: 1, is_active: 1 });
schema.index({ target_user_ids: 1 });
schema.index({ target_office_ids: 1 });
schema.index({ target_office_type_ids: 1 });
schema.index({ 'target_location.division_id': 1 });

export const ScheduleEvent = mongoose.model<IScheduleEvent>('ScheduleEvent', schema, 'schedule_events');
