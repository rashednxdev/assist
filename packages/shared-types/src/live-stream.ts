import { z } from 'zod';
import {
  comparisonTableSchema,
  cleanComparisonTable,
  hasComparisonTableContent,
} from './comparison-table.js';
import {
  explanationProcessSchema,
  cleanExplanationProcess,
  hasProcessContent,
} from './explanation.js';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);

export const LIVE_CLASS_ACCESS_TYPES = ['free', 'paid'] as const;
export type LiveClassAccessType = (typeof LIVE_CLASS_ACCESS_TYPES)[number];

/** Shown to unpaid users when a class is marked Paid. */
export const PAID_LIVE_CLASS_UNPAID_MESSAGE =
  'This Live Class only for Paid User. You are unpaid Mode. Pay to Enjoy Live Class.';

export const LIVE_STREAM_STATUSES = ['scheduled', 'live', 'paused', 'ended', 'cancelled'] as const;
export type LiveStreamStatus = (typeof LIVE_STREAM_STATUSES)[number];

export const LIVE_PERMISSION_STATUSES = ['permitted', 'not_permitted', 'host'] as const;
export type LivePermissionStatus = (typeof LIVE_PERMISSION_STATUSES)[number];

/** Batch grant/revoke — large lists OK (Agora live supports many audience). */
const inviteUserIds = z.array(mongoId).max(5000);
const inviteUserIdsNonEmpty = inviteUserIds.min(1);

export const liveStreamSlideSchema = z.object({
  /** May be empty when the slide is table/process-only. */
  title: z.string().trim().max(300).default(''),
  context: z.string().trim().max(15000).default(''),
  table: comparisonTableSchema.optional(),
  process: explanationProcessSchema.optional(),
});

export const liveStreamSlidesSchema = z.array(liveStreamSlideSchema).max(80);

export const createLiveStreamSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  details: z.string().trim().max(5000).optional(),
  scheduled_at: z.coerce.date(),
  /** Assigned class host (defaults to creating admin). */
  host_user_id: mongoId.optional(),
  /** Optional invite list at create time. */
  invite_user_ids: inviteUserIds.optional(),
  slides: liveStreamSlidesSchema.optional(),
  /** `free` = everyone invited; `paid` = only users with payment may join/watch. */
  access_type: z.enum(LIVE_CLASS_ACCESS_TYPES).optional().default('free'),
});

export const updateLiveStreamSchema = z.object({
  topic: z.string().trim().min(3).max(200).optional(),
  details: z.string().trim().max(5000).optional().nullable(),
  scheduled_at: z.coerce.date().optional(),
  status: z.enum(LIVE_STREAM_STATUSES).optional(),
  /** Reassign the class host (admin only). */
  host_user_id: mongoId.optional(),
  slides: liveStreamSlidesSchema.optional(),
  access_type: z.enum(LIVE_CLASS_ACCESS_TYPES).optional(),
});

export const liveStreamInvitesSchema = z.object({
  user_ids: inviteUserIdsNonEmpty,
});

export const liveStreamRevokeInvitesSchema = z.object({
  user_ids: inviteUserIdsNonEmpty,
});

/** Host tokens are web-only. The mobile app must omit as_host (always audience). */
export const joinLiveStreamSchema = z.object({
  as_host: z.boolean().optional(),
});

export const updateGuestMessagesSchema = z.object({
  allow_guest_messages: z.boolean(),
});

export const sendLiveStreamMessageSchema = z.object({
  body: z.string().trim().min(1).max(500),
});

export type CreateLiveStreamDto = z.infer<typeof createLiveStreamSchema>;
export type UpdateLiveStreamDto = z.infer<typeof updateLiveStreamSchema>;
export type LiveStreamInvitesDto = z.infer<typeof liveStreamInvitesSchema>;
export type LiveStreamRevokeInvitesDto = z.infer<typeof liveStreamRevokeInvitesSchema>;
export type JoinLiveStreamDto = z.infer<typeof joinLiveStreamSchema>;
export type UpdateGuestMessagesDto = z.infer<typeof updateGuestMessagesSchema>;
export type SendLiveStreamMessageDto = z.infer<typeof sendLiveStreamMessageSchema>;
export type LiveStreamSlide = z.infer<typeof liveStreamSlideSchema>;

export function cleanLiveStreamSlide(slide: LiveStreamSlide): LiveStreamSlide | null {
  const title = (slide.title ?? '').trim();
  const context = (slide.context ?? '').trim();
  const table = cleanComparisonTable(slide.table);
  const process = cleanExplanationProcess(slide.process);
  if (!title && !context && !hasComparisonTableContent(table) && !hasProcessContent(process)) {
    return null;
  }
  return {
    title,
    context,
    ...(table ? { table } : {}),
    ...(process ? { process } : {}),
  };
}

export function cleanLiveStreamSlides(slides?: LiveStreamSlide[] | null): LiveStreamSlide[] {
  return (slides ?? [])
    .map((s) => cleanLiveStreamSlide(s))
    .filter((s): s is LiveStreamSlide => s != null);
}

export interface LiveStreamGuestItem {
  id: string;
  user_id: string;
  name: string;
  email?: string;
  phone?: string;
  role: 'host' | 'audience';
  joined_at: string;
  last_seen_at: string;
}

export interface LiveStreamGuestMessageItem {
  id: string;
  from_user_id: string;
  from_name: string;
  body: string;
  created_at: string;
}

export interface LiveStreamListItem {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: LiveStreamStatus;
  host_user_id?: string;
  host_name?: string;
  invite_count?: number;
  permission_status: LivePermissionStatus;
  can_join: boolean;
  /** Past / ended class — only invitees see these in the user list. */
  is_previous: boolean;
  slide_count: number;
  slides?: LiveStreamSlide[];
  /**
   * Presentation content may be opened.
   * Invitees: after the class is previous/ended.
   * Admins/hosts: always (including upcoming) for review.
   */
  can_view_presentation: boolean;
  /** Host toggle: guests may send messages to the host while live. */
  allow_guest_messages: boolean;
  /** `free` or `paid` — paid classes block unpaid learners. */
  access_type: LiveClassAccessType;
  /** True when this user is unpaid and the class requires payment. */
  payment_blocked?: boolean;
  payment_required_message?: string;
  /** True for session host and platform admins — may request Agora host token. */
  can_host: boolean;
  created_at: string;
  updated_at: string;
}

export interface LiveStreamJoinPayload {
  app_id: string;
  channel: string;
  token: string | null;
  /** Unix seconds — client may re-join before this to refresh the token. */
  token_expires_at?: number;
  uid: number;
  role: 'host' | 'audience';
  topic: string;
  status: LiveStreamStatus;
  allow_guest_messages: boolean;
}
