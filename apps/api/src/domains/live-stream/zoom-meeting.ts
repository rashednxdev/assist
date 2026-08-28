import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { badRequest } from '../../shared/errors/AppError.js';

let cachedToken: { access_token: string; expires_at: number } | null = null;

export function zoomConfigured(): boolean {
  return Boolean(env.ZOOM_ACCOUNT_ID && env.ZOOM_CLIENT_ID && env.ZOOM_CLIENT_SECRET);
}

export function getZoomLiveVideoStatus() {
  const configured = zoomConfigured();
  const sdkSeparate = Boolean(env.ZOOM_SDK_KEY?.trim() && env.ZOOM_SDK_SECRET?.trim());
  return {
    configured,
    valid: configured,
    account_id_prefix: env.ZOOM_ACCOUNT_ID?.slice(0, 6),
    client_id_prefix: env.ZOOM_CLIENT_ID?.slice(0, 6),
    join_mode: 'zoom_web_client',
    meeting_sdk_optional: {
      configured: sdkSeparate,
      note: 'S2S OAuth is enough. Classes open Zoom Web Client (mic, camera, screen share). ZOOM_SDK_KEY is optional.',
    },
  };
}

async function getAccessToken(): Promise<string> {
  if (!zoomConfigured()) {
    throw badRequest('Zoom is not configured on the server (ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, ZOOM_CLIENT_SECRET).');
  }
  const now = Date.now();
  if (cachedToken && cachedToken.expires_at > now + 60_000) {
    return cachedToken.access_token;
  }
  const creds = Buffer.from(`${env.ZOOM_CLIENT_ID}:${env.ZOOM_CLIENT_SECRET}`).toString('base64');
  const url = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(env.ZOOM_ACCOUNT_ID!)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${creds}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw badRequest(`Zoom OAuth failed (${res.status}): ${text.slice(0, 240)}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    access_token: data.access_token,
    expires_at: now + data.expires_in * 1000,
  };
  return data.access_token;
}

export interface ZoomMeetingCreated {
  meeting_id: string;
  meeting_number: string;
  password: string;
  join_url: string;
  start_url: string;
}

export async function createZoomMeeting(opts: {
  topic: string;
  startTime: Date;
  durationMinutes?: number;
}): Promise<ZoomMeetingCreated> {
  const token = await getAccessToken();
  const body = {
    topic: opts.topic,
    type: 2,
    start_time: opts.startTime.toISOString(),
    duration: opts.durationMinutes ?? 120,
    timezone: 'UTC',
    settings: {
      host_video: true,
      participant_video: true,
      join_before_host: false,
      mute_upon_entry: true,
      waiting_room: false,
      audio: 'both',
      auto_recording: 'none',
      participant_can_unmute_self: true,
      allow_participants_to_rename: false,
    },
  };
  const res = await fetch('https://api.zoom.us/v2/users/me/meetings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw badRequest(`Zoom create meeting failed (${res.status}): ${text.slice(0, 320)}`);
  }
  const data = (await res.json()) as {
    id: number | string;
    join_url: string;
    start_url: string;
    password?: string;
  };
  const meetingNumber = String(data.id);
  return {
    meeting_id: meetingNumber,
    meeting_number: meetingNumber,
    password: data.password ?? '',
    join_url: data.join_url,
    start_url: data.start_url,
  };
}

/**
 * Zoom Web Client URLs — work with Server-to-Server OAuth only.
 * Full Zoom UI: two-way AV + screen share (no Meeting SDK JWT).
 */
export function buildZoomWebClientUrl(opts: {
  meetingNumber: string;
  password?: string;
  role: 'host' | 'audience';
  zak?: string;
}): string {
  const mn = String(opts.meetingNumber).replace(/\s+/g, '');
  if (opts.role === 'host') {
    const zak = opts.zak ? `?zak=${encodeURIComponent(opts.zak)}` : '';
    return `https://zoom.us/wc/${mn}/start${zak}`;
  }
  const pwd = opts.password ? `?pwd=${encodeURIComponent(opts.password)}` : '';
  return `https://zoom.us/wc/join/${mn}${pwd}`;
}

/**
 * Meeting SDK JWT — optional. Only when ZOOM_SDK_KEY + ZOOM_SDK_SECRET are set
 * (General app with Meeting SDK). S2S OAuth secrets cannot sign these.
 */
export function buildZoomSdkSignature(
  meetingNumber: string,
  role: 'host' | 'audience',
): { signature: string; sdk_key: string; expire_at: number } | null {
  if (!env.ZOOM_SDK_KEY?.trim() || !env.ZOOM_SDK_SECRET?.trim()) {
    return null;
  }
  const sdkKey = env.ZOOM_SDK_KEY.trim();
  const sdkSecret = env.ZOOM_SDK_SECRET.trim();

  const mn = String(meetingNumber).replace(/\s+/g, '');
  const iat = Math.floor(Date.now() / 1000) - 30;
  const exp = iat + 60 * 60 * 2;
  const payload = {
    appKey: sdkKey,
    sdkKey,
    mn,
    role: role === 'host' ? 1 : 0,
    iat,
    exp,
    tokenExp: exp,
  };

  const signature = jwt.sign(payload, sdkSecret, {
    algorithm: 'HS256',
    header: { alg: 'HS256', typ: 'JWT' },
    noTimestamp: true,
  });

  return { signature, sdk_key: sdkKey, expire_at: exp };
}

export async function fetchZoomZakToken(): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch('https://api.zoom.us/v2/users/me/token?type=zak', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw badRequest(`Zoom ZAK token failed (${res.status}): ${text.slice(0, 240)}`);
  }
  const data = (await res.json()) as { token: string };
  return data.token;
}
