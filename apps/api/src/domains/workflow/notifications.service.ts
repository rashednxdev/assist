import mongoose from 'mongoose';
import { Notification } from './models/Notification.model.js';
import { User } from '../users/models/User.model.js';

export async function createHandoffNotifications(params: {
  runId: string;
  stepId?: string;
  roleCode: string;
  title: string;
  message: string;
}) {
  const recipients = await User.find({
    status: 'active',
    workflow_roles: { $elemMatch: { role_code: params.roleCode, is_active: true } },
  });

  if (recipients.length === 0) return [];

  const docs = recipients.map((user) => ({
    recipient_id: user._id,
    run_id: new mongoose.Types.ObjectId(params.runId),
    step_id: params.stepId ? new mongoose.Types.ObjectId(params.stepId) : undefined,
    type: 'handoff' as const,
    title: params.title,
    message: params.message,
    is_read: false,
    created_at: new Date(),
  }));

  return Notification.insertMany(docs);
}

export async function listNotifications(userId: string, unreadOnly = false) {
  const filter: Record<string, unknown> = { recipient_id: userId };
  if (unreadOnly) filter.is_read = false;

  const items = await Notification.find(filter).sort({ created_at: -1 }).limit(50);
  return items.map((n) => ({
    id: String(n._id),
    run_id: String(n.run_id),
    type: n.type,
    title: n.title,
    message: n.message,
    is_read: n.is_read,
    read_at: n.read_at,
    created_at: n.created_at,
  }));
}

export async function markAllNotificationsRead(userId: string) {
  const result = await Notification.updateMany(
    { recipient_id: userId, is_read: false },
    { is_read: true, read_at: new Date() },
  );
  return { updated: result.modifiedCount };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const doc = await Notification.findOneAndUpdate(
    { _id: notificationId, recipient_id: userId },
    { is_read: true, read_at: new Date() },
    { new: true },
  );
  if (!doc) return null;
  return {
    id: String(doc._id),
    is_read: doc.is_read,
    read_at: doc.read_at,
  };
}
