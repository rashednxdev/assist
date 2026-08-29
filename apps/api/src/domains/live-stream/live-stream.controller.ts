import type { Response } from 'express';
import {
  createLiveStreamSchema,
  joinLiveStreamSchema,
  liveStreamInvitesSchema,
  liveStreamRevokeInvitesSchema,
  sendLiveStreamMessageSchema,
  updateGuestMessagesSchema,
  updateGuestSpeechSchema,
  updateLiveStreamSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import { parsePagination } from '../../shared/pagination.js';
import * as liveStreamService from './live-stream.service.js';

function platformFromQuery(req: AuthRequest): string | undefined {
  const raw = req.query.video_platform;
  if (raw === 'agora' || raw === 'zoom') return raw;
  return undefined;
}

export async function listLiveStreamsHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.listLiveStreamsForUser(req.user!, {
    video_platform: platformFromQuery(req),
  });
  res.json({ data });
}

export async function listHostingLiveStreamsHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.listHostingLiveStreams(req.user!, {
    video_platform: platformFromQuery(req),
  });
  res.json({ data });
}

export async function getLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.getLiveStreamForUser(String(req.params.id), req.user!);
  res.json({ data });
}

export async function joinLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = joinLiveStreamSchema.parse(req.body ?? {});
  const data = await liveStreamService.joinLiveStream(String(req.params.id), req.user!, {
    as_host: dto.as_host,
  });
  res.json({ data });
}

export async function listGuestsHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.listGuests(String(req.params.id));
  res.json({ data });
}

export async function setGuestMessagesHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateGuestMessagesSchema.parse(req.body);
  const data = await liveStreamService.setGuestMessagesAllowed(
    String(req.params.id),
    dto.allow_guest_messages,
  );
  res.json({ data });
}

export async function setGuestSpeechHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateGuestSpeechSchema.parse(req.body);
  const data = await liveStreamService.setGuestSpeechAllowed(
    String(req.params.id),
    dto.allow_guest_speech,
  );
  res.json({ data });
}

export async function sendGuestMessageHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = sendLiveStreamMessageSchema.parse(req.body);
  const data = await liveStreamService.sendGuestMessage(
    String(req.params.id),
    req.user!,
    dto.body,
  );
  res.status(201).json({ data });
}

export async function listGuestMessagesHandler(req: AuthRequest, res: Response): Promise<void> {
  const after = typeof req.query.after === 'string' ? req.query.after : undefined;
  const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
  const data = await liveStreamService.listGuestMessages(String(req.params.id), {
    after,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  });
  res.json({ data });
}

export async function listAdminLiveStreamsHandler(req: AuthRequest, res: Response): Promise<void> {
  const { page, limit, skip } = parsePagination(req);
  const { items, total } = await liveStreamService.listAdminLiveStreams(limit, skip, {
    video_platform: platformFromQuery(req),
  });
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

export async function pauseLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.pauseLiveStream(String(req.params.id));
  res.json({ data });
}

export async function resumeLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.resumeLiveStream(String(req.params.id));
  res.json({ data });
}

export async function restartLiveStreamHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.restartLiveStream(String(req.params.id));
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

export async function revokeInvitesHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = liveStreamRevokeInvitesSchema.parse(req.body);
  const data = await liveStreamService.revokeInvites(String(req.params.id), dto.user_ids);
  res.json({ data });
}

export async function removeInviteHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await liveStreamService.removeInvite(String(req.params.id), String(req.params.userId));
  res.json({ data });
}
