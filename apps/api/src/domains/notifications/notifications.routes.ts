import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireModulePermission } from '../../middleware/requireModulePermission.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  sendNotificationHandler,
  listSentNotificationsHandler,
  listMyNotificationsHandler,
  markNotificationReadHandler,
  markAllNotificationsReadHandler,
  registerDeviceHandler,
  unregisterDeviceHandler,
  stopRemainingDeliveryHandler,
  removeNotificationHandler,
} from './notifications.controller.js';

export const adminNotificationsRouter = Router();

adminNotificationsRouter.use(authenticate);

adminNotificationsRouter.get('/mine', asyncHandler(listMyNotificationsHandler));
adminNotificationsRouter.patch('/mine/:id/read', asyncHandler(markNotificationReadHandler));
adminNotificationsRouter.post('/mine/read-all', asyncHandler(markAllNotificationsReadHandler));
adminNotificationsRouter.post('/devices', asyncHandler(registerDeviceHandler));
adminNotificationsRouter.delete('/devices/:deviceId', asyncHandler(unregisterDeviceHandler));

const notifySendAccess = requireModulePermission([
  { moduleCode: 'NOTICE', permission: 'can_create' },
  { moduleCode: 'USER', permission: 'can_create' },
  { moduleCode: 'USER', permission: 'can_update' },
]);

adminNotificationsRouter.post('/', notifySendAccess, asyncHandler(sendNotificationHandler));
adminNotificationsRouter.get('/', notifySendAccess, asyncHandler(listSentNotificationsHandler));
adminNotificationsRouter.post('/:id/stop', notifySendAccess, asyncHandler(stopRemainingDeliveryHandler));
adminNotificationsRouter.delete('/:id', notifySendAccess, asyncHandler(removeNotificationHandler));
