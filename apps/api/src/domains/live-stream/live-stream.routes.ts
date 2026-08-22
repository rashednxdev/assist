import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
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
  listGuestsHandler,
  listInvitesHandler,
  listLiveStreamsHandler,
  pauseLiveStreamHandler,
  removeInviteHandler,
  restartLiveStreamHandler,
  resumeLiveStreamHandler,
  revokeInvitesHandler,
  startLiveStreamHandler,
  updateLiveStreamHandler,
} from './live-stream.controller.js';

export const liveStreamRouter = Router();

liveStreamRouter.use(authenticate);

liveStreamRouter.get('/admin', requireAdmin, asyncHandler(listAdminLiveStreamsHandler));
liveStreamRouter.post('/', requireAdmin, asyncHandler(createLiveStreamHandler));
liveStreamRouter.patch('/:id', requireAdmin, asyncHandler(updateLiveStreamHandler));
liveStreamRouter.delete('/:id', requireAdmin, asyncHandler(deleteLiveStreamHandler));
liveStreamRouter.post('/:id/start', requireAdmin, asyncHandler(startLiveStreamHandler));
liveStreamRouter.post('/:id/pause', requireAdmin, asyncHandler(pauseLiveStreamHandler));
liveStreamRouter.post('/:id/resume', requireAdmin, asyncHandler(resumeLiveStreamHandler));
liveStreamRouter.post('/:id/restart', requireAdmin, asyncHandler(restartLiveStreamHandler));
liveStreamRouter.post('/:id/end', requireAdmin, asyncHandler(endLiveStreamHandler));
liveStreamRouter.get('/:id/invites', requireAdmin, asyncHandler(listInvitesHandler));
liveStreamRouter.get('/:id/guests', requireAdmin, asyncHandler(listGuestsHandler));
liveStreamRouter.post('/:id/invites', requireAdmin, asyncHandler(addInvitesHandler));
liveStreamRouter.post('/:id/invites/revoke', requireAdmin, asyncHandler(revokeInvitesHandler));
liveStreamRouter.delete('/:id/invites/:userId', requireAdmin, asyncHandler(removeInviteHandler));

liveStreamRouter.get('/', requireModuleAccess('LIVE_STREAM'), asyncHandler(listLiveStreamsHandler));
liveStreamRouter.get('/:id', requireModuleAccess('LIVE_STREAM'), asyncHandler(getLiveStreamHandler));
liveStreamRouter.post('/:id/join', requireModuleAccess('LIVE_STREAM'), asyncHandler(joinLiveStreamHandler));
