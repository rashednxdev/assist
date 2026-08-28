import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { env } from '../../config/env.js';
import { badRequest } from '../../shared/errors/AppError.js';

// agora-token is CommonJS; named ESM imports fail at runtime on Node.
const require = createRequire(import.meta.url);
const { RtcRole, RtcTokenBuilder } = require('agora-token') as {
  RtcRole: { PUBLISHER: number; SUBSCRIBER: number };
  RtcTokenBuilder: {
    buildTokenWithUid: (
      appId: string,
      appCertificate: string,
      channelName: string,
      uid: number,
      role: number,
      tokenExpire: number,
      privilegeExpire: number,
    ) => string;
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
/** 2 hours 10 minutes — host/guest stay connected without re-join. */
export const AGORA_TOKEN_TTL_SECONDS = 60 * 130;

function normalizeAgoraKey(value: string | undefined): string {
  return value?.trim().replace(/^["']|["']$/g, '').toLowerCase() ?? '';
}

export function isValidAgoraKey(value: string | undefined): boolean {
  const key = normalizeAgoraKey(value);
  return key.length === AGORA_KEY_LEN && AGORA_KEY_RE.test(key);
}

export function agoraUsesToken(): boolean {
  const certificate = normalizeAgoraKey(env.AGORA_APP_CERTIFICATE);
  // Certificate on Render → always mint tokens (Primary Certificate enabled in Agora Console).
  if (isValidAgoraKey(certificate)) return true;
  return process.env.AGORA_USE_TOKEN !== 'false';
}

/** Public-safe Agora config check for /health (does not call Agora servers). */
export function getAgoraLiveVideoStatus(): {
  configured: boolean;
  valid: boolean;
  uses_token: boolean;
  certificate_on_server: boolean;
  app_id_prefix?: string;
  token_mint_ok?: boolean;
  token_builder: 'buildTokenWithUid';
  issue?: string;
  warning?: string;
} {
  const appId = normalizeAgoraKey(env.AGORA_APP_ID);
  const certificate = normalizeAgoraKey(env.AGORA_APP_CERTIFICATE);
  const certificateOnServer = isValidAgoraKey(certificate);
  const usesToken = agoraUsesToken();

  if (!appId) {
    return {
      configured: false,
      valid: false,
      uses_token: usesToken,
      certificate_on_server: certificateOnServer,
      token_builder: 'buildTokenWithUid',
      issue: 'Set AGORA_APP_ID on the API server.',
    };
  }

  if (!isValidAgoraKey(appId)) {
    return {
      configured: true,
      valid: false,
      uses_token: usesToken,
      certificate_on_server: certificateOnServer,
      token_builder: 'buildTokenWithUid',
      issue: 'AGORA_APP_ID must be exactly 32 hex characters (no spaces or quotes).',
    };
  }

  if (!certificateOnServer) {
    return {
      configured: true,
      valid: false,
      uses_token: false,
      certificate_on_server: false,
      app_id_prefix: appId.slice(0, 8),
      token_builder: 'buildTokenWithUid',
      issue:
        'AGORA_APP_CERTIFICATE is missing on the API server. Add Primary Certificate from Agora Console → Project → Config, then redeploy.',
      warning:
        'If Primary Certificate is enabled in Agora, joins without a token always fail (CAN_NOT_GET_GATEWAY_SERVER).',
    };
  }

  let tokenMintOk = true;
  if (usesToken) {
    try {
      const sample = RtcTokenBuilder.buildTokenWithUid(
        appId,
        certificate,
        'health_check',
        1,
        RtcRole.PUBLISHER,
        300,
        300,
      );
      tokenMintOk = Boolean(sample && sample.startsWith('007'));
    } catch {
      tokenMintOk = false;
    }
  }

  return {
    configured: true,
    valid: usesToken ? tokenMintOk : true,
    uses_token: usesToken,
    certificate_on_server: certificateOnServer,
    app_id_prefix: appId.slice(0, 8),
    token_mint_ok: tokenMintOk,
    token_builder: 'buildTokenWithUid',
    warning:
      'token_mint_ok only checks local token generation. Use /health/agora-test in Agora Web Demo to verify credentials with Agora servers.',
    ...(usesToken && !tokenMintOk
      ? {
          issue:
            'Token mint failed — AGORA_APP_ID and AGORA_APP_CERTIFICATE must be from the same Agora project.',
        }
      : {}),
    ...(process.env.AGORA_USE_TOKEN === 'false' && certificateOnServer
      ? {
          warning:
            'AGORA_USE_TOKEN=false is ignored because AGORA_APP_CERTIFICATE is set (token mode is required).',
        }
      : {}),
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
}): { appId: string; token: string | null; expireAt: number } {
  const appId = normalizeAgoraKey(env.AGORA_APP_ID);
  if (!appId || !isValidAgoraKey(appId)) {
    throw badRequest(
      'Live video is not configured. Set a valid AGORA_APP_ID (32 hex chars) on the API.',
    );
  }

  const expireSeconds = opts.expireSeconds ?? AGORA_TOKEN_TTL_SECONDS;
  const expireAt = Math.floor(Date.now() / 1000) + expireSeconds;

  if (!agoraUsesToken()) {
    return { appId, token: null, expireAt };
  }

  const certificate = normalizeAgoraKey(env.AGORA_APP_CERTIFICATE);
  if (!isValidAgoraKey(certificate)) {
    throw badRequest(
      'AGORA_APP_CERTIFICATE is invalid. Copy the Primary Certificate from Agora Console → Project → Config.',
    );
  }

  const rtcRole = opts.role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const joinUid = opts.uid > 0 ? opts.uid : 1;
  // Token uid must match the uid passed to client.join() — mismatch causes gateway errors.
  const token =
    opts.role === 'host'
      ? RtcTokenBuilder.buildTokenWithUidAndPrivilege(
          appId,
          certificate,
          opts.channel,
          joinUid,
          expireSeconds,
          expireSeconds,
          expireSeconds,
          expireSeconds,
          expireSeconds,
        )
      : RtcTokenBuilder.buildTokenWithUid(
          appId,
          certificate,
          opts.channel,
          joinUid,
          rtcRole,
          expireSeconds,
          expireSeconds,
        );

  if (!token || !token.startsWith('007')) {
    throw badRequest(
      'Could not mint Agora token. Verify AGORA_APP_ID and AGORA_APP_CERTIFICATE match the same project in Agora Console.',
    );
  }

  return { appId, token, expireAt };
}

/** Sample host join for Agora Web Demo — verifies credentials reach Agora (public App ID). */
export function buildAgoraSampleJoin() {
  return buildAgoraRtcToken({
    channel: 'proassist_credential_test',
    uid: 10_001,
    role: 'host',
    expireSeconds: 3600,
  });
}
