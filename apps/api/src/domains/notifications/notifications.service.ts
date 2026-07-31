import type { SendNotificationDto, RegisterDeviceTokenDto } from '@ibas/shared-types';
import { User } from '../users/models/User.model.js';
import { AdminNotification } from './models/AdminNotification.model.js';
import { NotificationRecipient } from './models/NotificationRecipient.model.js';
import { DeviceToken } from './models/DeviceToken.model.js';
import { sendPushToUsers } from './push.service.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';

const RECIPIENT_INSERT_CHUNK_SIZE = 1000;

function serializeNotification(row: InstanceType<typeof AdminNotification>) {
  return {
    id: String(row._id),
    title: row.title,
    message: row.message,
    target_type: row.target_type,
    target_user_ids: row.target_user_ids?.map((id) => String(id)),
    recipient_count: row.recipient_count,
    push_sent_count: row.push_sent_count,
    push_failed_count: row.push_failed_count,
    created_by: String(row.created_by),
    sent_at: row.sent_at.toISOString(),
  };
}

function serializeRecipient(
  row: InstanceType<typeof NotificationRecipient>,
  notification: { title: string; message: string },
) {
  return {
    id: String(row._id),
    notification_id: String(row.notification_id),
    title: notification.title,
    message: notification.message,
    is_read: row.is_read,
    read_at: row.read_at?.toISOString(),
    created_at: row.created_at.toISOString(),
  };
}

export async function sendNotification(dto: SendNotificationDto, createdBy: string) {
  let userIds: string[];
  if (dto.target_type === 'all') {
    const users = await User.find({ status: 'active' }).select('_id');
    userIds = users.map((u) => String(u._id));
  } else {
    const ids = dto.target_user_ids ?? [];
    const users = await User.find({ _id: { $in: ids }, status: 'active' }).select('_id');
    userIds = users.map((u) => String(u._id));
    if (userIds.length === 0) throw badRequest('None of the selected users are valid/active');
  }

  const notification = await AdminNotification.create({
    title: dto.title,
    message: dto.message,
    target_type: dto.target_type,
    target_user_ids: dto.target_type === 'specific' ? userIds : undefined,
    created_by: createdBy,
    sent_at: new Date(),
    recipient_count: userIds.length,
  });

  for (let i = 0; i < userIds.length; i += RECIPIENT_INSERT_CHUNK_SIZE) {
    const chunk = userIds.slice(i, i + RECIPIENT_INSERT_CHUNK_SIZE);
    await NotificationRecipient.insertMany(
      chunk.map((userId) => ({ notification_id: notification._id, user_id: userId })),
      { ordered: false },
    );
  }

  const { sent, failed } = await sendPushToUsers(userIds, dto.title, dto.message, {
    notification_id: String(notification._id),
  });
  notification.push_sent_count = sent;
  notification.push_failed_count = failed;
  await notification.save();

  return serializeNotification(notification);
}

export async function listSentNotifications(limit: number, offset: number) {
  const [items, total] = await Promise.all([
    AdminNotification.find().sort({ sent_at: -1 }).skip(offset).limit(limit),
    AdminNotification.countDocuments(),
  ]);
  return { items: items.map(serializeNotification), total };
}

export async function listMyNotifications(
  userId: string,
  filters: { unread_only?: boolean; limit: number; offset: number },
) {
  const query: Record<string, unknown> = { user_id: userId };
  if (filters.unread_only) query.is_read = false;

  const [rows, total] = await Promise.all([
    NotificationRecipient.find(query).sort({ created_at: -1 }).skip(filters.offset).limit(filters.limit),
    NotificationRecipient.countDocuments(query),
  ]);

  const notificationIds = [...new Set(rows.map((r) => String(r.notification_id)))];
  const notifications = await AdminNotification.find({ _id: { $in: notificationIds } }).select(
    'title message',
  );
  const notificationMap = new Map(notifications.map((n) => [String(n._id), n]));

  const items = rows
    .map((row) => {
      const notification = notificationMap.get(String(row.notification_id));
      if (!notification) return null;
      return serializeRecipient(row, notification);
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  const unreadCount = await NotificationRecipient.countDocuments({ user_id: userId, is_read: false });

  return { items, total, unread_count: unreadCount };
}

export async function markNotificationRead(userId: string, recipientId: string) {
  const row = await NotificationRecipient.findOneAndUpdate(
    { _id: recipientId, user_id: userId },
    { is_read: true, read_at: new Date() },
    { new: true },
  );
  if (!row) throw notFound('Notification not found');
  return { id: String(row._id), is_read: row.is_read };
}

export async function markAllNotificationsRead(userId: string) {
  await NotificationRecipient.updateMany(
    { user_id: userId, is_read: false },
    { is_read: true, read_at: new Date() },
  );
  return { marked: true };
}

export async function registerDeviceToken(userId: string, dto: RegisterDeviceTokenDto) {
  await DeviceToken.findOneAndUpdate(
    { expo_push_token: dto.expo_push_token },
    {
      user_id: userId,
      device_id: dto.device_id,
      expo_push_token: dto.expo_push_token,
      platform: 'android',
      is_active: true,
      last_seen_at: new Date(),
    },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return { registered: true };
}

export async function unregisterDeviceToken(userId: string, deviceId: string) {
  await DeviceToken.updateMany({ user_id: userId, device_id: deviceId }, { is_active: false });
  return { unregistered: true };
}
