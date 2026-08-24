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

/** Embedded Agora one-to-many room: host publishes mic + camera/screen; audience watches full share. */
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
  const [micMuted, setMicMuted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function ensureMicPublished(client: IAgoraRTCClient) {
      const mic = micRef.current;
      if (!mic) return;
      try {
        mic.setVolume(100);
      } catch {
        // ignore
      }
      const published = client.localTracks.some((t) => t === mic);
      if (!published) {
        await client.publish(mic);
      }
    }

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
              track.play(remoteRef.current, { fit: 'contain' });
              setHasRemote(true);
            }
          }
          if (mediaType === 'audio') {
            user.audioTrack?.play();
            try {
              user.audioTrack?.setVolume(100);
            } catch {
              // ignore
            }
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
          // Mic first and independently — speech must reach guests even if camera fails.
          const mic = await AgoraRTC.createMicrophoneAudioTrack({
            AEC: true,
            AGC: true,
            ANS: true,
          });
          if (cancelled) {
            mic.close();
            return;
          }
          micRef.current = mic;
          mic.setVolume(100);
          await client.publish(mic);

          try {
            const cam = await AgoraRTC.createCameraVideoTrack();
            if (cancelled) {
              cam.close();
              return;
            }
            camRef.current = cam;
            if (localRef.current) {
              localRef.current.innerHTML = '';
              cam.play(localRef.current, { fit: 'contain' });
            }
            await client.publish(cam);
          } catch (camErr) {
            const camMsg =
              camErr instanceof Error ? camErr.message : 'Camera unavailable';
            setStatus(`Mic is live (camera: ${camMsg}). You can still share screen.`);
          }

          await ensureMicPublished(client);
          setStatus('You are live — speak with mic on, share screen when ready');
          setReady(true);
          setMicMuted(false);
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
        cam.play(localRef.current, { fit: 'contain' });
      }
      try {
        await client.publish(cam);
      } catch {
        // already published
      }
      setStatus('Screen share stopped — camera is live');
    }

    // Mic must stay published across screen share stop/start.
    const mic = micRef.current;
    if (mic && client) {
      try {
        mic.setVolume(100);
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
    setStatus(next ? 'Microphone muted' : 'Microphone on — your speech reaches viewers');
  }

  async function startScreenShare() {
    const client = clientRef.current;
    const AgoraRTC = agoraRef.current;
    const cam = camRef.current;
    if (!client || !AgoraRTC || role !== 'host' || busy) return;

    setBusy(true);
    try {
      // Video-only screen track; keep the separate mic track for host speech.
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

      // Re-assert mic after screen publish (some browsers drop other tracks).
      const mic = micRef.current;
      if (mic) {
        try {
          mic.setVolume(100);
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
          : 'Sharing screen + mic — guests hear you and see the full desktop',
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
        {role === 'host' && ready ? (
          <>
            <Button type="button" variant="outline" size="sm" disabled={busy} onClick={toggleMic}>
              {micMuted ? 'Unmute speech' : 'Mute speech'}
            </Button>
            {sharing ? (
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void stopScreenShare()}>
                Stop sharing
              </Button>
            ) : (
              <Button type="button" size="sm" disabled={busy} onClick={() => void startScreenShare()}>
                Share screen
              </Button>
            )}
          </>
        ) : null}
      </div>
      {role === 'host' ? (
        <div className="overflow-hidden rounded-2xl border bg-slate-950 aspect-video">
          <div ref={localRef} className="h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-contain" />
        </div>
      ) : (
        <div className="relative min-h-[50vh] overflow-hidden rounded-2xl border bg-slate-950 sm:min-h-[70vh]">
          <div
            ref={remoteRef}
            className="absolute inset-0 h-full w-full [&_video]:h-full [&_video]:w-full [&_video]:object-contain"
          />
          {!hasRemote ? (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-slate-300">
              Host screen will appear here (full view)
            </div>
          ) : null}
        </div>
      )}
      {/* Hidden remote mount for host if needed later */}
      {role === 'host' ? <div ref={remoteRef} className="hidden" /> : null}
      {role === 'host' ? (
        <p className="text-xs text-muted-foreground">
          Keep <strong>Unmute speech</strong> on while sharing. Guests should hear your mic and see the full
          shared screen (rotate phone to landscape if needed). Use Chrome/Edge on this PC.
        </p>
      ) : null}
    </div>
  );
}
