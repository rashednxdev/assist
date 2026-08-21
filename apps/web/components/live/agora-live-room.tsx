'use client';

import { useEffect, useRef, useState } from 'react';
import type {
  IAgoraRTCClient,
  ICameraVideoTrack,
  ILocalVideoTrack,
  IMicrophoneAudioTrack,
  IRemoteVideoTrack,
} from 'agora-rtc-sdk-ng';
import { Button } from '@/components/ui/button';

interface AgoraLiveRoomProps {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  role: 'host' | 'audience';
  onError?: (message: string) => void;
}

/** Embedded Agora one-to-many room: host publishes camera/mic or screen; audience watches. */
export function AgoraLiveRoom({ appId, channel, token, uid, role, onError }: AgoraLiveRoomProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const micRef = useRef<IMicrophoneAudioTrack | null>(null);
  const camRef = useRef<ICameraVideoTrack | null>(null);
  const screenRef = useRef<ILocalVideoTrack | null>(null);
  const agoraRef = useRef<typeof import('agora-rtc-sdk-ng').default | null>(null);

  const [status, setStatus] = useState('Connecting…');
  const [hasRemote, setHasRemote] = useState(false);
  const [ready, setReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        if (cancelled) return;
        agoraRef.current = AgoraRTC;

        const client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        clientRef.current = client;
        await client.setClientRole(role === 'host' ? 'host' : 'audience');

        client.on('user-published', async (user, mediaType) => {
          await client.subscribe(user, mediaType);
          if (mediaType === 'video') {
            const track = user.videoTrack as IRemoteVideoTrack | undefined;
            if (track && remoteRef.current) {
              remoteRef.current.innerHTML = '';
              track.play(remoteRef.current);
              setHasRemote(true);
            }
          }
          if (mediaType === 'audio') {
            user.audioTrack?.play();
          }
        });

        client.on('user-unpublished', (_user, mediaType) => {
          if (mediaType === 'video') {
            setHasRemote(false);
            if (remoteRef.current) remoteRef.current.innerHTML = '';
          }
        });

        await client.join(appId, channel, token, uid);
        if (cancelled) return;

        if (role === 'host') {
          const [mic, cam] = await AgoraRTC.createMicrophoneAndCameraTracks();
          if (cancelled) {
            mic.close();
            cam.close();
            return;
          }
          micRef.current = mic;
          camRef.current = cam;
          if (localRef.current) {
            localRef.current.innerHTML = '';
            cam.play(localRef.current);
          }
          await client.publish([mic, cam]);
          setStatus('You are live — share your screen when ready');
          setReady(true);
        } else {
          setStatus('Joined as viewer — waiting for the host…');
          setReady(true);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not join live session';
        setStatus(message);
        onError?.(message);
      }
    }

    void start();

    return () => {
      cancelled = true;
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
  }, [appId, channel, token, uid, role, onError]);

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
        cam.play(localRef.current);
      }
      try {
        await client.publish(cam);
      } catch {
        // already published
      }
      setStatus('Screen share stopped — camera is live');
    }
  }

  async function startScreenShare() {
    const client = clientRef.current;
    const AgoraRTC = agoraRef.current;
    const cam = camRef.current;
    if (!client || !AgoraRTC || role !== 'host' || busy) return;

    setBusy(true);
    try {
      const screenTrack = await AgoraRTC.createScreenVideoTrack(
        { encoderConfig: '1080p_1', optimizationMode: 'detail' },
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
        screen.play(localRef.current);
      }
      await client.publish(screen);
      setSharing(true);
      setStatus('Sharing your screen — viewers see your desktop');

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
        {role === 'host' && ready ? (
          sharing ? (
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void stopScreenShare()}>
              Stop sharing
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={busy} onClick={() => void startScreenShare()}>
              Share screen
            </Button>
          )
        ) : null}
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {role === 'host' ? (
          <div className="overflow-hidden rounded-2xl border bg-slate-950 aspect-video">
            <div ref={localRef} className="h-full w-full" />
          </div>
        ) : null}
        <div className="overflow-hidden rounded-2xl border bg-slate-950 aspect-video relative">
          <div ref={remoteRef} className="h-full w-full" />
          {!hasRemote && role === 'audience' ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
              Host video will appear here
            </div>
          ) : null}
        </div>
      </div>
      {role === 'host' ? (
        <p className="text-xs text-muted-foreground">
          Use Chrome or Edge on a PC. Click Share screen, pick a window or entire display, then invited users
          watching in the app will see it.
        </p>
      ) : null}
    </div>
  );
}
