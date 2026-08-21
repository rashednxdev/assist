import { apiFetch } from './api';
import type { LivePermissionStatus, LiveStreamJoinPayload, LiveStreamStatus } from '@ibas/shared-types';

export interface LiveStreamListItem {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: LiveStreamStatus;
  host_name?: string;
  permission_status: LivePermissionStatus;
  can_join: boolean;
}

export async function fetchLiveStreams() {
  const res = await apiFetch<{ data: LiveStreamListItem[] }>('/live-streams');
  return res.data;
}

export async function fetchLiveStream(id: string) {
  const res = await apiFetch<{ data: LiveStreamListItem & { invite_count?: number } }>(
    `/live-streams/${id}`,
  );
  return res.data;
}

export async function joinLiveStream(id: string) {
  const res = await apiFetch<{ data: LiveStreamJoinPayload }>(`/live-streams/${id}/join`, {
    method: 'POST',
  });
  return res.data;
}
