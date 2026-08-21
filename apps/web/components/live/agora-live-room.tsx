'use client';

import { useEffect, useRef, useState } from 'react';
import type { IAgoraRTCClient, ICameraVideoTrack, IMicrophoneAudioTrack, IRemoteVideoTrack } from 'agora-rtc-sdk-ng';

interface AgoraLiveRoomProps {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  role: 'host' | 'audience';
  onError?: (message: string) => void;
}

/** Embedded Agora one-to-many room: host publishes camera/mic; audience watches. */
export function AgoraLiveRoom({ appId, channel, token, uid, role, onError }: AgoraLiveRoomProps) {
  const localRef = useRef<HTMLDivElement>(null);
  const remoteRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState('Connecting…');
  const [hasRemote, setHasRemote] = useState(false);

  useEffect(() => {
    let client: IAgoraRTCClient | null = null;
    let mic: IMicrophoneAudioTrack | null = null;
    let cam: ICameraVideoTrack | null = null;
    let cancelled = false;

    async function start() {
      try {
        const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
        client = AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
        await client.setClientRole(role === 'host' ? 'host' : 'audience');

        client.on('user-published', async (user, mediaType) => {
          if (!client) return;
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

        client.on('user-unpublished', (user, mediaType) => {
          if (mediaType === 'video') {
            setHasRemote(false);
            if (remoteRef.current) remoteRef.current.innerHTML = '';
          }
        });

        await client.join(appId, channel, token, uid);
        if (cancelled) return;

        if (role === 'host') {
          [mic, cam] = await AgoraRTC.createMicrophoneAndCameraTracks();
          if (cancelled) {
            mic.close();
            cam.close();
            return;
          }
          if (localRef.current) {
            localRef.current.innerHTML = '';
            cam.play(localRef.current);
          }
          await client.publish([mic, cam]);
          setStatus('You are live — viewers can watch');
        } else {
          setStatus('Joined as viewer — waiting for the host…');
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
          mic?.close();
          cam?.close();
          await client?.leave();
          client?.removeAllListeners();
        } catch {
          // ignore cleanup errors
        }
      })();
    };
  }, [appId, channel, token, uid, role, onError]);

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-slate-600">{status}</p>
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
    </div>
  );
}
