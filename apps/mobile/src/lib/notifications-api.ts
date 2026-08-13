import { apiFetch } from './api';
import type { AdminNotificationRecord, NotificationRecipientRecord } from '@ibas/shared-types';

export type { AdminNotificationRecord, NotificationRecipientRecord };

export async function fetchSentNotifications() {
  return apiFetch<{ data: AdminNotificationRecord[]; meta: { total: number } }>(
    '/admin-notifications?limit=50',
  );
}

export async function stopRemainingNotification(id: string) {
  return apiFetch<{ data: AdminNotificationRecord }>(`/admin-notifications/${id}/stop`, {
    method: 'POST',
  });
}

export async function removeSentNotification(id: string) {
  return apiFetch<{ data: AdminNotificationRecord }>(`/admin-notifications/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchMyNotifications(unreadOnly = false) {
  const params = new URLSearchParams({ limit: '50' });
  if (unreadOnly) params.set('unread_only', 'true');
  return apiFetch<{
    data: NotificationRecipientRecord[];
    meta: { total: number; unread_count: number };
  }>(`/admin-notifications/mine?${params.toString()}`);
}

export async function markNotificationRead(id: string) {
  return apiFetch<{ data: { id: string; is_read: boolean } }>(
    `/admin-notifications/mine/${id}/read`,
    { method: 'PATCH' },
  );
}

export async function markAllNotificationsRead() {
  return apiFetch<{ data: { marked: boolean } }>('/admin-notifications/mine/read-all', {
    method: 'POST',
  });
}

export async function registerDeviceToken(deviceId: string, expoPushToken: string) {
  return apiFetch<{ data: { registered: boolean } }>('/admin-notifications/devices', {
    method: 'POST',
    body: JSON.stringify({ device_id: deviceId, expo_push_token: expoPushToken }),
  });
}

export async function unregisterDeviceToken(deviceId: string) {
  return apiFetch<{ data: { unregistered: boolean } }>(
    `/admin-notifications/devices/${deviceId}`,
    { method: 'DELETE' },
  );
}
