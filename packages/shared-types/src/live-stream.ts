import { z } from 'zod';

const mongoId = z.string().regex(/^[a-f\d]{24}$/i);

export const LIVE_STREAM_STATUSES = ['scheduled', 'live', 'paused', 'ended', 'cancelled'] as const;
export type LiveStreamStatus = (typeof LIVE_STREAM_STATUSES)[number];

export const LIVE_PERMISSION_STATUSES = ['permitted', 'not_permitted', 'host'] as const;
export type LivePermissionStatus = (typeof LIVE_PERMISSION_STATUSES)[number];

/** Batch grant/revoke — large lists OK (Agora live supports many audience). */
const inviteUserIds = z.array(mongoId).max(5000);
const inviteUserIdsNonEmpty = inviteUserIds.min(1);

export const createLiveStreamSchema = z.object({
  topic: z.string().trim().min(3).max(200),
  details: z.string().trim().max(5000).optional(),
  scheduled_at: z.coerce.date(),
  /** Optional invite list at create time. */
  invite_user_ids: inviteUserIds.optional(),
});

export const updateLiveStreamSchema = z.object({
  topic: z.string().trim().min(3).max(200).optional(),
  details: z.string().trim().max(5000).optional().nullable(),
  scheduled_at: z.coerce.date().optional(),
  status: z.enum(LIVE_STREAM_STATUSES).optional(),
});

export const liveStreamInvitesSchema = z.object({
  user_ids: inviteUserIdsNonEmpty,
});

export const liveStreamRevokeInvitesSchema = z.object({
  user_ids: inviteUserIdsNonEmpty,
});

export type CreateLiveStreamDto = z.infer<typeof createLiveStreamSchema>;
export type UpdateLiveStreamDto = z.infer<typeof updateLiveStreamSchema>;
export type LiveStreamInvitesDto = z.infer<typeof liveStreamInvitesSchema>;
export type LiveStreamRevokeInvitesDto = z.infer<typeof liveStreamRevokeInvitesSchema>;

export interface LiveStreamListItem {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: LiveStreamStatus;
  host_name?: string;
  invite_count?: number;
  permission_status: LivePermissionStatus;
  can_join: boolean;
  created_at: string;
  updated_at: string;
}

export interface LiveStreamJoinPayload {
  app_id: string;
  channel: string;
  token: string;
  uid: number;
  role: 'host' | 'audience';
  topic: string;
  status: LiveStreamStatus;
}
