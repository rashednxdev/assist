import { apiFetch } from './api';
import type {
  LivePermissionStatus,
  LiveStreamJoinPayload,
  LiveStreamSlide,
  LiveStreamStatus,
  LiveVideoPlatform,
} from '@ibas/shared-types';

export interface LiveStreamListItem {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: LiveStreamStatus;
  video_platform?: LiveVideoPlatform;
  host_name?: string;
  permission_status: LivePermissionStatus;
  can_join: boolean;
  is_previous?: boolean;
  slide_count?: number;
  slides?: LiveStreamSlide[];
  invite_count?: number;
  allow_guest_messages?: boolean;
  /** Admins/hosts: always; invitees: after class ends. */
  can_view_presentation?: boolean;
  access_type?: 'free' | 'paid';
  payment_blocked?: boolean;
  payment_required_message?: string;
}

export async function fetchLiveStreams(platform?: LiveVideoPlatform) {
  const qs = platform ? `?video_platform=${platform}` : '';
  const res = await apiFetch<{ data: LiveStreamListItem[] }>(`/live-streams${qs}`);
  return res.data;
}

export async function fetchLiveStream(id: string) {
  const res = await apiFetch<{ data: LiveStreamListItem }>(`/live-streams/${id}`);
  return res.data;
}

export async function joinLiveStream(id: string) {
  const res = await apiFetch<{ data: LiveStreamJoinPayload }>(`/live-streams/${id}/join`, {
    method: 'POST',
    body: JSON.stringify({ as_host: false }),
  });
  return res.data;
}

export async function sendLiveStreamMessage(id: string, body: string) {
  const res = await apiFetch<{ data: { id: string } }>(`/live-streams/${id}/messages`, {
    method: 'POST',
    body: JSON.stringify({ body }),
  });
  return res.data;
}
