import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireLiveHostOrAdmin } from '../../middleware/requireLiveHostOrAdmin.js';
import { requireModuleAccess } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  addInvitesHandler,
  createLiveStreamHandler,
  deleteLiveStreamHandler,
  endLiveStreamHandler,
  getLiveStreamHandler,
  joinLiveStreamHandler,
  listAdminLiveStreamsHandler,
  listGuestMessagesHandler,
  listGuestsHandler,
  listHostingLiveStreamsHandler,
  listInvitesHandler,
  listLiveStreamsHandler,
  pauseLiveStreamHandler,
  removeInviteHandler,
  restartLiveStreamHandler,
  resumeLiveStreamHandler,
  revokeInvitesHandler,
  sendGuestMessageHandler,
  setGuestMessagesHandler,
  setGuestSpeechHandler,
  startLiveStreamHandler,
  updateLiveStreamHandler,
} from './live-stream.controller.js';

export const liveStreamRouter = Router();

liveStreamRouter.use(authenticate);

liveStreamRouter.get('/admin', requireAdmin, asyncHandler(listAdminLiveStreamsHandler));
liveStreamRouter.post('/', requireAdmin, asyncHandler(createLiveStreamHandler));
liveStreamRouter.patch('/:id', requireAdmin, asyncHandler(updateLiveStreamHandler));
liveStreamRouter.delete('/:id', requireAdmin, asyncHandler(deleteLiveStreamHandler));
liveStreamRouter.post('/:id/start', requireLiveHostOrAdmin, asyncHandler(startLiveStreamHandler));
liveStreamRouter.post('/:id/pause', requireLiveHostOrAdmin, asyncHandler(pauseLiveStreamHandler));
liveStreamRouter.post('/:id/resume', requireLiveHostOrAdmin, asyncHandler(resumeLiveStreamHandler));
liveStreamRouter.post('/:id/restart', requireLiveHostOrAdmin, asyncHandler(restartLiveStreamHandler));
liveStreamRouter.post('/:id/end', requireLiveHostOrAdmin, asyncHandler(endLiveStreamHandler));
liveStreamRouter.get('/:id/invites', requireAdmin, asyncHandler(listInvitesHandler));
liveStreamRouter.get('/:id/guests', requireLiveHostOrAdmin, asyncHandler(listGuestsHandler));
liveStreamRouter.get('/:id/messages', requireLiveHostOrAdmin, asyncHandler(listGuestMessagesHandler));
liveStreamRouter.patch(
  '/:id/guest-messages',
  requireLiveHostOrAdmin,
  asyncHandler(setGuestMessagesHandler),
);
liveStreamRouter.patch(
  '/:id/guest-speech',
  requireLiveHostOrAdmin,
  asyncHandler(setGuestSpeechHandler),
);
liveStreamRouter.post('/:id/invites', requireAdmin, asyncHandler(addInvitesHandler));
liveStreamRouter.post('/:id/invites/revoke', requireAdmin, asyncHandler(revokeInvitesHandler));
liveStreamRouter.delete('/:id/invites/:userId', requireAdmin, asyncHandler(removeInviteHandler));

liveStreamRouter.get('/', requireModuleAccess('LIVE_STREAM'), asyncHandler(listLiveStreamsHandler));
liveStreamRouter.get(
  '/hosting',
  requireModuleAccess('LIVE_STREAM'),
  asyncHandler(listHostingLiveStreamsHandler),
);
liveStreamRouter.get('/:id', requireModuleAccess('LIVE_STREAM'), asyncHandler(getLiveStreamHandler));
liveStreamRouter.post('/:id/join', requireModuleAccess('LIVE_STREAM'), asyncHandler(joinLiveStreamHandler));
liveStreamRouter.post(
  '/:id/messages',
  requireModuleAccess('LIVE_STREAM'),
  asyncHandler(sendGuestMessageHandler),
);
