import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { env } from '../../config/env.js';
import { badRequest } from '../../shared/errors/AppError.js';

// agora-token is CommonJS; named ESM imports fail at runtime on Node.
const require = createRequire(import.meta.url);
const { RtcTokenBuilder } = require('agora-token') as {
  RtcTokenBuilder: {
    buildTokenWithUidAndPrivilege: (
      appId: string,
      appCertificate: string,
      channelName: string,
      uid: number,
      tokenExpire: number,
      joinChannelPrivilegeExpire: number,
      pubAudioPrivilegeExpire: number,
      pubVideoPrivilegeExpire: number,
      pubDataStreamPrivilegeExpire: number,
    ) => string;
  };
};

const AGORA_KEY_LEN = 32;
const AGORA_KEY_RE = /^[a-f0-9]{32}$/i;

function normalizeAgoraKey(value: string | undefined): string {
  return value?.trim().replace(/^["']|["']$/g, '') ?? '';
}

export function isValidAgoraKey(value: string | undefined): boolean {
  const key = normalizeAgoraKey(value);
  return key.length === AGORA_KEY_LEN && AGORA_KEY_RE.test(key);
}

/** Whether live video env vars are present and well-formed (does not call Agora). */
export function getAgoraLiveVideoStatus(): {
  configured: boolean;
  valid: boolean;
  app_id_prefix?: string;
  issue?: string;
} {
  const appId = normalizeAgoraKey(env.AGORA_APP_ID);
  const certificate = normalizeAgoraKey(env.AGORA_APP_CERTIFICATE);

  if (!appId || !certificate) {
    return {
      configured: false,
      valid: false,
      issue: 'Set AGORA_APP_ID and AGORA_APP_CERTIFICATE on the API server.',
    };
  }

  if (!isValidAgoraKey(appId)) {
    return {
      configured: true,
      valid: false,
      issue: 'AGORA_APP_ID must be exactly 32 hexadecimal characters from the Agora Console.',
    };
  }

  if (!isValidAgoraKey(certificate)) {
    return {
      configured: true,
      valid: false,
      issue:
        'AGORA_APP_CERTIFICATE must be exactly 32 hexadecimal characters (Primary Certificate).',
    };
  }

  return {
    configured: true,
    valid: true,
    app_id_prefix: appId.slice(0, 8),
  };
}

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
  const status = getAgoraLiveVideoStatus();
  if (!status.valid) {
    throw badRequest(status.issue ?? 'Live video is not configured on the API server.');
  }

  const appId = normalizeAgoraKey(env.AGORA_APP_ID);
  const certificate = normalizeAgoraKey(env.AGORA_APP_CERTIFICATE);

  // Agora AccessToken2 expects TTL seconds from now (not a unix timestamp).
  const expireSeconds = opts.expireSeconds ?? 60 * 90;
  const expireAt = Math.floor(Date.now() / 1000) + expireSeconds;
  const mayPublish = opts.role === 'host';

  const token = RtcTokenBuilder.buildTokenWithUidAndPrivilege(
    appId,
    certificate,
    opts.channel,
    opts.uid,
    expireSeconds,
    expireSeconds,
    mayPublish ? expireSeconds : 0,
    mayPublish ? expireSeconds : 0,
    mayPublish ? expireSeconds : 0,
  );

  if (!token || !token.startsWith('007')) {
    throw badRequest(
      'Could not mint a valid Agora token. Confirm AGORA_APP_ID and AGORA_APP_CERTIFICATE match the same Agora project (Console → Project → Config).',
    );
  }

  return { appId, token, expireAt };
}
