import { createHash } from 'node:crypto';
import { RtcRole, RtcTokenBuilder } from 'agora-token';
import { env } from '../../config/env.js';
import { badRequest } from '../../shared/errors/AppError.js';

/** Stable Agora uid from Mongo user id (1..2^31-2). */
export function agoraUidFromUserId(userId: string): number {
  const hex = createHash('sha256').update(userId).digest('hex').slice(0, 8);
  const n = Number.parseInt(hex, 16) % 2_147_483_646;
  return n === 0 ? 1 : n;
}

export function buildAgoraRtcToken(opts: {
  channel: string;
  uid: number;
  role: 'host' | 'audience';
  expireSeconds?: number;
}): { appId: string; token: string; expireAt: number } {
  const appId = env.AGORA_APP_ID?.trim();
  const certificate = env.AGORA_APP_CERTIFICATE?.trim();
  if (!appId || !certificate) {
    throw badRequest(
      'Live video is not configured. Set AGORA_APP_ID and AGORA_APP_CERTIFICATE on the API.',
    );
  }

  const expireSeconds = opts.expireSeconds ?? 60 * 60 * 6;
  const expireAt = Math.floor(Date.now() / 1000) + expireSeconds;
  const role = opts.role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    certificate,
    opts.channel,
    opts.uid,
    role,
    expireAt,
    expireAt,
  );
  return { appId, token, expireAt };
}
