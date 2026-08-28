'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  IAgoraRTCClient,
  IAgoraRTCRemoteUser,
  ICameraVideoTrack,
  ILocalVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteAudioTrack,
  IRemoteVideoTrack,
} from 'agora-rtc-sdk-ng';
import { Button } from '@/components/ui/button';

interface AgoraLiveRoomProps {
  appId: string;
  channel: string;
  token: string | null;
  uid: number;
  role: 'host' | 'audience';
  onError?: (message: string) => void;
}

function isMobileBrowser() {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

function screenShareSupported() {
  if (typeof navigator === 'undefined') return false;
  return Boolean(navigator.mediaDevices?.getDisplayMedia) && !isMobileBrowser();
}

function isGatewayJoinError(message: string): boolean {
  return /CAN_NOT_GET_GATEWAY_SERVER|invalid vendor key|can not find appid|dynamic use static key/i.test(
    message,
  );
}

function joinHelpMessage(appId: string, usedToken: boolean): string {
  const prefix = appId.slice(0, 8);
  return (
    `Agora rejected the connection (App ID ${prefix}…). ` +
    (usedToken
      ? 'The certificate on Render likely does not match Agora Console → Primary Certificate. ' +
        'Open https://ibas-api.onrender.com/api/v1/health/agora-test and test in Agora Web Demo. ' +
        'If certificate auth is OFF in Agora, set AGORA_USE_TOKEN=false on Render.'
      : 'Tokenless join also failed — verify the App ID is active in Agora Console or try another network.')
  );
}

/** Embedded Agora one-to-many room: host publishes mic (+ camera/screen); audience hears & watches. */
export function AgoraLiveRoom({ appId, channel, token, uid, role, onError }: AgoraLiveRoomProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camRef = useRef<ICameraVideoTrack | null>(null);
  const screenRef = useRef<ILocalVideoTrack | null>(null);
  const agoraRef = useRef<typeof import('agora-rtc-sdk-ng').default | null>(null);
  const remoteAudioRef = useRef<IRemoteAudioTrack[]>([]);

  const [status, setStatus] = useState('Connecting to channel…');
  const [hasRemote, setHasRemote] = useState(false);
  const [channelReady, setChannelReady] = useState(false);
  const [mediaLive, setMediaLive] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const canShareScreen = screenShareSupported();

  const playRemoteAudio = useCallback(async (track: IRemoteAudioTrack | undefined) => {
    if (!track) return;
    try {
      // Remote volume: 100 = original; many SDK builds allow up to ~400 for boost.
      track.setVolume(400);
    } catch {
      try {
        track.setVolume(100);
      } catch {
        // ignore
      }
    }
    try {
      await track.play();
    } catch {
      // autoplay may block until user taps Enable sound
    }
    if (!remoteAudioRef.current.includes(track)) {
      remoteAudioRef.current.push(track);
    }
  }, []);

  const subscribeExisting = useCallback(
    async (client: IAgoraRTCClient) => {
      for (const user of client.remoteUsers) {
        if (user.hasAudio) {
          try {
            await client.subscribe(user, 'audio');
            await playRemoteAudio(user.audioTrack);
          } catch {
            // ignore one-user failures
          }
        }
        if (user.hasVideo && remoteRef.current) {
          try {
            await client.subscribe(user, 'video');
            const track = user.videoTrack as IRemoteVideoTrack | undefined;
            if (track) {
              remoteRef.current.innerHTML = '';
              track.play(remoteRef.current, { fit: 'contain' });
              setHasRemote(true);
            }
          } catch {
            // ignore
          }
        }
      }
    },
    [playRemoteAudio],
  );

  useEffect(() => {
    let cancelled = false;
    let levelTimer: number | undefined;

    async function connect() {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        if (cancelled) return;
        agoraRef.current = AgoraRTC;

        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        clientRef.current = client;
        await client.setClientRole(role === 'host' ? 'host' : 'audience');

        client.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === 'video') {
            const track = user.videoTrack as IRemoteVideoTrack | undefined;
            if (track && remoteRef.current) {
              remoteRef.current.innerHTML = '';
              track.play(remoteRef.current, { fit: 'contain' });
              setHasRemote(true);
            }
          }
          if (mediaType === 'audio') {
            await playRemoteAudio(user.audioTrack);
          }
        });

        client.on('user-unpublished', (_user, mediaType) => {
          if (mediaType === 'video') {
            setHasRemote(false);
            if (remoteRef.current) remoteRef.current.innerHTML = '';
          }
        });

        const numericUid = Number(uid);
        let joined = false;
        try {
          await client.join(appId.trim().toLowerCase(), channel, token || null, numericUid);
          joined = true;
        } catch (firstErr) {
          const firstMsg = firstErr instanceof Error ? firstErr.message : '';
          // Certificate disabled in Agora Console → token join fails; App-ID-only join works.
          if (token && isGatewayJoinError(firstMsg)) {
            try {
              await client.join(appId.trim().toLowerCase(), channel, null, numericUid);
              joined = true;
            } catch {
              throw firstErr;
            }
          } else {
            throw firstErr;
          }
        }
        if (!joined) throw new Error('Could not join live session');
        if (cancelled) return;

        await subscribeExisting(client);

        if (role === 'host') {
          setStatus('Connected — tap “Start mic & go live” (required on phones)');
        } else {
          setStatus('Connected — tap “Enable sound” to hear the host');
        }
        setChannelReady(true);
      } catch (err) {
        const raw = err instanceof Error ? err.message : 'Could not join live session';
        const message = isGatewayJoinError(raw) ? joinHelpMessage(appId, Boolean(token)) : raw;
        setStatus(message);
        onError?.(message);
      }
    }

    void connect();

    return () => {
      cancelled = true;
      if (levelTimer) window.clearInterval(levelTimer);
      void (async () => {
        try {
          screenRef.current?.close();
          screenRef.current = null;
          micRef.current?.close();
          micRef.current = null;
          camRef.current?.close();
          camRef.current = null;
          await clientRef.current?.leave();
          clientRef.current?.removeAllListeners();
          clientRef.current = null;
        } catch {
          // ignore cleanup errors
        }
      })();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- join once per credentials
  }, [appId, channel, token, uid, role, onError, playRemoteAudio, subscribeExisting]);

  // Mic level meter while publishing (confirms speech is leaving this device).
  useEffect(() => {
    if (!mediaLive || role !== 'host') return;
    const timer = window.setInterval(() => {
      const mic = micRef.current;
      if (!mic) return;
      try {
        const level = Math.round(mic.getVolumeLevel() * 100);
        setMicLevel(level);
      } catch {
        // ignore
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [mediaLive, role]);

  async function enableAudienceSound() {
    setBusy(true);
    try {
      // Unlock autoplay policy, then replay every remote audio track.
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (Ctx) {
          const ctx = new Ctx();
          if (ctx.state === 'suspended') await ctx.resume();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          gain.gain.value = 0.0001;
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.04);
        }
      } catch {
        // ignore
      }

      const client = clientRef.current;
      if (client) await subscribeExisting(client);

      for (const track of remoteAudioRef.current) {
        try {
          track.setVolume(400);
          await track.play();
        } catch {
          try {
            track.setVolume(100);
            await track.play();
          } catch {
            // ignore
          }
        }
      }
      setSoundOn(true);
      setStatus('Sound on — you should hear the host');
    } finally {
      setBusy(false);
    }
  }

  async function startHostMedia() {
    const client = clientRef.current;
    const AgoraRTC = agoraRef.current;
    if (!client || !AgoraRTC || role !== 'host' || busy || mediaLive) return;

    setBusy(true);
    setStatus('Requesting microphone…');
    try {
      // Must run from a user tap on mobile browsers.
      const mic = await AgoraRTC.createMicrophoneAudioTrack({
        AEC: true,
        AGC: true,
        ANS: false, // ANS can swallow speech on some phones
      });
      micRef.current = mic;
      // Local mic: 100 = original, up to 1000. Boost so guests hear clearly.
      mic.setVolume(400);
      await mic.setEnabled(true);
      await client.publish([mic]);

      try {
        const cam = await AgoraRTC.createCameraVideoTrack();
        camRef.current = cam;
        if (localRef.current) {
          localRef.current.innerHTML = '';
          cam.play(localRef.current, { fit: 'contain' });
        }
        await client.publish([cam]);
      } catch (camErr) {
        const camMsg = camErr instanceof Error ? camErr.message : 'Camera unavailable';
        setStatus(`Mic live (no camera: ${camMsg}). Guests should hear you.`);
      }

      // Confirm mic is still among published tracks.
      if (!client.localTracks.includes(mic)) {
        await client.publish([mic]);
      }

      setMediaLive(true);
      setMicMuted(false);
      setStatus('You are live — speak now. Guests must tap Enable sound.');
    } catch (err) {
      const message =
        err instanceof Error && /NotAllowedError|Permission denied|NotFoundError/i.test(err.message)
          ? 'Microphone permission denied or missing. Allow mic in browser settings, then try again.'
          : err instanceof Error
            ? err.message
            : 'Could not start microphone';
      setStatus(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  async function stopScreenShare(opts?: { restoreCamera?: boolean }) {
    const client = clientRef.current;
    const screen = screenRef.current;
    const cam = camRef.current;
    const restoreCamera = opts?.restoreCamera !== false;

    if (screen && client) {
      try {
        await client.unpublish(screen);
      } catch {
        // may already be unpublished
      }
      screen.close();
      screenRef.current = null;
    }

    setSharing(false);

    if (restoreCamera && cam && client) {
      if (localRef.current) {
        localRef.current.innerHTML = '';
        cam.play(localRef.current, { fit: 'contain' });
      }
      try {
        await client.publish(cam);
      } catch {
        // already published
      }
      setStatus('Screen share stopped — camera is live');
    }

    const mic = micRef.current;
    if (mic && client) {
      try {
        mic.setVolume(400);
        if (!client.localTracks.includes(mic)) await client.publish(mic);
      } catch {
        // ignore
      }
    }
  }

  function toggleMic() {
    const mic = micRef.current;
    if (!mic || role !== 'host') return;
    const next = !micMuted;
    void mic.setEnabled(!next);
    setMicMuted(next);
    setStatus(next ? 'Microphone muted' : 'Microphone on — speech is publishing');
  }

  async function startScreenShare() {
    const client = clientRef.current;
    const AgoraRTC = agoraRef.current;
    const cam = camRef.current;
    if (!client || !AgoraRTC || role !== 'host' || busy) return;
    if (!canShareScreen) {
      setStatus('Screen share needs desktop Chrome/Edge. On phone, use camera + mic.');
      return;
    }

    setBusy(true);
    try {
      const screenTrack = await AgoraRTC.createScreenVideoTrack(
        {
          encoderConfig: {
            width: 1920,
            height: 1080,
            frameRate: 15,
            bitrateMax: 3000,
            bitrateMin: 1000,
          },
          optimizationMode: 'detail',
        },
        'disable',
      );
      const screen = Array.isArray(screenTrack) ? screenTrack[0] : screenTrack;

      if (cam) {
        try {
          await client.unpublish(cam);
        } catch {
          // ignore
        }
        cam.stop();
      }

      screenRef.current = screen;
      if (localRef.current) {
        localRef.current.innerHTML = '';
        screen.play(localRef.current, { fit: 'contain' });
      }
      await client.publish(screen);

      const mic = micRef.current;
      if (mic) {
        try {
          mic.setVolume(400);
          if (!micMuted) await mic.setEnabled(true);
          if (!client.localTracks.includes(mic)) await client.publish(mic);
        } catch {
          // ignore
        }
      }

      setSharing(true);
      setStatus(
        micMuted
          ? 'Sharing screen — unmute speech so guests can hear you'
          : 'Sharing screen + mic — check mic level meter while speaking',
      );

      screen.on('track-ended', () => {
        void stopScreenShare({ restoreCamera: true });
      });
    } catch (err) {
      const message =
        err instanceof Error && /Permission denied|NotAllowedError|cancel/i.test(err.message)
          ? 'Screen share cancelled or blocked by the browser'
          : err instanceof Error
            ? err.message
            : 'Could not start screen share';
      setStatus(message);
      onError?.(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-medium text-slate-600">{status}</p>
        {role === 'host' && channelReady && !mediaLive ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void startHostMedia()}>
            Start mic &amp; go live
          </Button>
        ) : null}
        {role === 'audience' && channelReady && !soundOn ? (
          <Button type="button" size="sm" disabled={busy} onClick={() => void enableAudienceSound()}>
            Enable sound
          </Button>
        ) : null}
        {role === 'host' && mediaLive ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={toggleMic}>
              {micMuted ? 'Unmute speech' : 'Mute speech'}
            </Button>
            {canShareScreen ? (
              sharing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => void stopScreenShare()}
                >
                  Stop sharing
                </Button>
              ) : (
                <Button type="button" size="sm" disabled={busy} onClick={() => void startScreenShare()}>
                  Share screen
                </Button>
              )
            ) : (
              <span className="text-xs text-muted-foreground">Screen share: desktop only</span>
            )}
          </>
        ) : null}
        {role === 'audience' && soundOn ? (
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void enableAudienceSound()}>
            Replay sound
          </Button>
        ) : null}
      </div>

      {role === 'host' && mediaLive ? (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="font-semibold">Mic level</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-100">
            <div
              className="h-full rounded-full bg-emerald-600 transition-[width] duration-100"
              style={{ width: `${Math.min(100, micLevel)}%` }}
            />
          </div>
          <span className="w-10 text-right text-xs font-bold">{micLevel}%</span>
          <span className="text-xs opacity-80">
            {micMuted ? 'Muted' : micLevel < 2 ? 'Speak louder / check mic' : 'Publishing'}
          </span>
        </div>
      ) : null}

      {role === 'host' ? (
        <div className="overflow-hidden rounded-2xl border bg-slate-950 aspect-video">
          <div
            ref={localRef}
            className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
          />
        </div>
      ) : (
        <div className="relative min-h-[50vh] overflow-hidden rounded-2xl border bg-slate-950 sm:min-h-[70vh]">
          <div
            ref={remoteRef}
            className="absolute inset-0 h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
          />
          {!hasRemote ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
              Host video will appear here
            </div>
          ) : null}
        </div>
      )}
      {role === 'host' ? <div ref={remoteRef} className="hidden" /> : null}

      {role === 'host' ? (
        <p className="text-xs text-muted-foreground">
          On phone: tap <strong>Start mic &amp; go live</strong>, allow microphone, then speak — watch the mic
          level move. Screen share works on desktop Chrome/Edge only. Guests must tap <strong>Enable sound</strong>.
          When class is finished, click <strong>End session</strong> so Agora minutes stop (saves cost).
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          If you see video but no voice, tap <strong>Enable sound</strong>. Leave the page when done so the
          channel connection closes.
        </p>
      )}
    </div>
  );
}
