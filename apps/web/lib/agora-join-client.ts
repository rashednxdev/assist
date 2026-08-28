import type { IAgoraRTCClient } from 'agora-rtc-sdk-ng';

export function isGatewayJoinError(message: string): boolean {
  return /CAN_NOT_GET_GATEWAY_SERVER|invalid vendor key|can not find appid|dynamic use static key|invalid token/i.test(
    message,
  );
}

export async function joinAgoraChannel(opts: {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  role: 'host' | 'audience';
}): Promise<IAgoraRTCClient> {
  const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
  const numericUid = Number(opts.uid);
  if (!Number.isFinite(numericUid) || numericUid <= 0) {
    throw new Error('Invalid Agora user id');
  }
  if (!opts.token.startsWith('007')) {
    throw new Error('Invalid Agora token from server');
  }

  const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
  await client.setClientRole(opts.role === 'host' ? 'host' : 'audience');
  await client.join(opts.appId.trim(), opts.channel, opts.token, numericUid);
  return client;
}
