import type { Response } from 'express';
import {
  sendNotificationSchema,
  registerDeviceTokenSchema,
  listNotificationsQuerySchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import { parsePagination } from '../../shared/pagination.js';
import * as notificationsService from './notifications.service.js';

export async function sendNotificationHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = sendNotificationSchema.parse(req.body);
  const data = await notificationsService.sendNotification(dto, req.user!.id);
  res.status(201).json({ data });
}

export async function listSentNotificationsHandler(req: AuthRequest, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req);
  const { items, total } = await notificationsService.listSentNotifications(limit, skip);
  res.json({ data: items, meta: { page, limit, total } });
}

export async function listMyNotificationsHandler(req: AuthRequest, res: Response): Promise<void> {
  const query = listNotificationsQuerySchema.parse(req.query);
  const { items, total, unread_count } = await notificationsService.listMyNotifications(req.user!.id, {
    unread_only: query.unread_only,
    limit: query.limit,
    offset: query.offset,
  });
  res.json({ data: items, meta: { limit: query.limit, offset: query.offset, total, unread_count } });
}

export async function markNotificationReadHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await notificationsService.markNotificationRead(req.user!.id, String(req.params.id));
  res.json({ data });
}

export async function markAllNotificationsReadHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await notificationsService.markAllNotificationsRead(req.user!.id);
  res.json({ data });
}

export async function registerDeviceHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = registerDeviceTokenSchema.parse(req.body);
  const data = await notificationsService.registerDeviceToken(req.user!.id, dto);
  res.status(201).json({ data });
}

export async function unregisterDeviceHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await notificationsService.unregisterDeviceToken(req.user!.id, String(req.params.deviceId));
  res.json({ data });
}

export async function stopRemainingDeliveryHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await notificationsService.stopRemainingDelivery(String(req.params.id), req.user!.id);
  res.json({ data });
}

export async function removeNotificationHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await notificationsService.removeNotification(String(req.params.id), req.user!.id);
  res.json({ data });
}
