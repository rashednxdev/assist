import mongoose, { Schema, type Document, type Types } from 'mongoose';
import type { ComparisonTable, ExplanationProcess, LiveStreamStatus, LiveClassAccessType, LiveVideoPlatform } from '@ibas/shared-types';

export interface ILiveStreamSlide {
  title: string;
  context: string;
  table?: ComparisonTable;
  process?: ExplanationProcess;
}

export interface ILiveStream extends Document {
  topic: string;
  details?: string;
  scheduled_at: Date;
  status: LiveStreamStatus;
  /** Agora channel name — stable unique id for the session. */
  channel_name: string;
  /** `agora` (default) or `zoom`. */
  video_platform: LiveVideoPlatform;
  /** Zoom REST meeting id (string). */
  zoom_meeting_id?: string;
  /** Zoom meeting number passed to Meeting SDK join. */
  zoom_meeting_number?: string;
  zoom_password?: string;
  zoom_join_url?: string;
  host_user_id: Types.ObjectId;
  created_by: Types.ObjectId;
  is_active: boolean;
  started_at?: Date;
  ended_at?: Date;
  /** When true, invited guests may send messages to the host while the class is live. */
  allow_guest_messages: boolean;
  /** When true, guests may unmute and speak (Zoom participant_can_unmute_self). */
  allow_guest_speech: boolean;
  /** Published class presentation slides (title + context + optional table/process). */
  slides: ILiveStreamSlide[];
  /** `free` = all invitees; `paid` = only paid users may join/watch. */
  access_type: LiveClassAccessType;
  created_at: Date;
  updated_at: Date;
}

const slideSchema = new Schema(
  {
    title: { type: String, default: '', trim: true },
    context: { type: String, default: '', trim: true },
    table: { type: Schema.Types.Mixed },
    process: { type: Schema.Types.Mixed },
  },
  { _id: false },
);

const schema = new Schema<ILiveStream>(
  {
    topic: { type: String, required: true, trim: true },
    details: { type: String, trim: true },
    scheduled_at: { type: Date, required: true },
    status: {
      type: String,
      enum: ['scheduled', 'live', 'paused', 'ended', 'cancelled'],
      default: 'scheduled',
    },
    channel_name: { type: String, required: true, unique: true },
    video_platform: { type: String, enum: ['agora', 'zoom'], default: 'agora' },
    zoom_meeting_id: { type: String },
    zoom_meeting_number: { type: String },
    zoom_password: { type: String },
    zoom_join_url: { type: String },
    host_user_id: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    created_by: { type: Schema.Types.ObjectId, required: true, ref: 'User' },
    is_active: { type: Boolean, default: true },
    started_at: { type: Date },
    ended_at: { type: Date },
    allow_guest_messages: { type: Boolean, default: false },
    allow_guest_speech: { type: Boolean, default: false },
    slides: { type: [slideSchema], default: [] },
    access_type: { type: String, enum: ['free', 'paid'], default: 'free' },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

schema.index({ scheduled_at: -1, is_active: 1 });
schema.index({ status: 1, is_active: 1 });
schema.index({ video_platform: 1, is_active: 1 });

export const LiveStream = mongoose.model<ILiveStream>('LiveStream', schema, 'live_streams');
