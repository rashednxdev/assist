import type { IAgoraRTCClient } from 'agora-rtc-sdk-ng';

export function isGatewayJoinError(message: string): boolean {
  return /CAN_NOT_GET_GATEWAY_SERVER|invalid vendor key|can not find appid|dynamic use static key|invalid token|ICE|gateway/i.test(
    message,
  );
}

type AgoraRtcStatic = typeof import('agora-rtc-sdk-ng').default & {
  startProxyServer?: (mode: number) => Promise<void>;
};
type AgoraClient = IAgoraRTCClient & {
  startProxyServer?: (mode: number) => Promise<void>;
};

async function tryStartCloudProxy(AgoraRTC: AgoraRtcStatic, client: AgoraClient): Promise<boolean> {
  // 3 = UDP/TCP proxy — helps when ISP/firewall blocks direct Agora gateway (common in BD/corporate networks).
  const mode = 3;
  try {
    if (typeof AgoraRTC.startProxyServer === 'function') {
      await AgoraRTC.startProxyServer(mode);
      return true;
    }
  } catch {
    // fall through
  }
  try {
    if (typeof client.startProxyServer === 'function') {
      await client.startProxyServer(mode);
      return true;
    }
  } catch {
    // fall through
  }
  return false;
}

export async function joinAgoraChannel(opts: {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  role: 'host' | 'audience';
}): Promise<IAgoraRTCClient> {
  const AgoraRTC = (await import('agora-rtc-sdk-ng')).default as AgoraRtcStatic;
  const numericUid = Number(opts.uid);
  if (!Number.isFinite(numericUid) || numericUid <= 0) {
    throw new Error('Invalid Agora user id');
  }
  if (!opts.token.startsWith('007')) {
    throw new Error('Invalid Agora token from server');
  }

  const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' }) as AgoraClient;
  await client.setClientRole(opts.role === 'host' ? 'host' : 'audience');

  const appId = opts.appId.trim();
  const doJoin = () => client.join(appId, opts.channel, opts.token, numericUid);

  try {
    await doJoin();
    return client;
  } catch (firstErr) {
    const firstMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    if (!isGatewayJoinError(firstMsg)) {
      throw firstErr;
    }

    const proxied = await tryStartCloudProxy(AgoraRTC, client);
    if (!proxied) {
      throw new Error(
        `${firstMsg} — Try mobile hotspot or another network. Your Agora credentials on the API look correct.`,
      );
    }

    try {
      await doJoin();
      return client;
    } catch (secondErr) {
      const secondMsg = secondErr instanceof Error ? secondErr.message : String(secondErr);
      throw new Error(
        `${secondMsg} — Direct and proxy join both failed. Enable Cloud Proxy in Agora Console for this project, or try another network.`,
      );
    }
  }
}
