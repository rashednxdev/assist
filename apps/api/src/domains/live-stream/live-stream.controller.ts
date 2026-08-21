import type { Response } from 'express';
import {
  createLiveStreamSchema,
  liveStreamInvitesSchema,
  updateLiveStreamSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import { parsePagination } from '../../shared/pagination.js';
import * as liveStreamService from './live-stream.service.js';

export async function listLiveStreamsHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.listLiveStreamsForUser(req.user!);
  res.json({ data });
}

export async function getLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.getLiveStreamForUser(String(req.params.id), req.user!);
  res.json({ data });
}

export async function joinLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.joinLiveStream(String(req.params.id), req.user!);
  res.json({ data });
}

export async function listAdminLiveStreamsHandler(req: AuthRequest, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req);
  const { items, total } = await liveStreamService.listAdminLiveStreams(limit, skip);
  res.json({ data: items, meta: { page, limit, total } });
}

export async function createLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createLiveStreamSchema.parse(req.body);
  const data = await liveStreamService.createLiveStream(dto, req.user!.id);
  res.status(201).json({ data });
}

export async function updateLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateLiveStreamSchema.parse(req.body);
  const data = await liveStreamService.updateLiveStream(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.softDeleteLiveStream(String(req.params.id));
  res.json({ data });
}

export async function startLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.startLiveStream(String(req.params.id));
  res.json({ data });
}

export async function endLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.endLiveStream(String(req.params.id));
  res.json({ data });
}

export async function listInvitesHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.listInvites(String(req.params.id));
  res.json({ data });
}

export async function addInvitesHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = liveStreamInvitesSchema.parse(req.body);
  const data = await liveStreamService.addInvites(String(req.params.id), dto.user_ids, req.user!.id);
  res.json({ data });
}

export async function removeInviteHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.removeInvite(String(req.params.id), String(req.params.userId));
  res.json({ data });
}
