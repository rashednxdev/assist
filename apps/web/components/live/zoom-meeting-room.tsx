'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';

export interface ZoomMeetingJoinConfig {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  password: string;
  userName: string;
  userEmail?: string;
  zak?: string;
  role: 'host' | 'audience';
}

interface ZoomMeetingRoomProps {
  config: ZoomMeetingJoinConfig;
  onError?: (message: string) => void;
  onLeave?: () => void;
}

/** Embedded Zoom Meeting SDK — two-way AV, screen share, host controls (Pro). */
export function ZoomMeetingRoom({ config, onError, onLeave }: ZoomMeetingRoomProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<{ leaveMeeting: () => Promise<unknown> } | null>(null);
  const [status, setStatus] = useState('Initializing Zoom…');
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    let cancelled = false;

    async function run() {
      try {
        setStatus('Loading Zoom Meeting SDK…');
        const ZoomMtgEmbedded = (await import('@zoom/meetingsdk/embedded')).default;
        const client = ZoomMtgEmbedded.createClient();
        clientRef.current = client;

        await client.init({
          zoomAppRoot: root as HTMLElement,
          language: 'en-US',
          patchJsMedia: true,
          leaveOnPageUnload: true,
        });
        if (cancelled) return;

        setStatus('Joining meeting…');
        await client.join({
          sdkKey: config.sdkKey,
          signature: config.signature,
          meetingNumber: config.meetingNumber,
          password: config.password,
          userName: config.userName,
          userEmail: config.userEmail,
          zak: config.zak,
        });
        if (cancelled) return;
        setJoined(true);
        setStatus('');
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Zoom join failed';
        if (!cancelled) {
          setStatus(msg);
          onError?.(msg);
        }
      }
    }

    void run();

    return () => {
      cancelled = true;
      void clientRef.current?.leaveMeeting().catch(() => undefined);
      clientRef.current = null;
    };
  }, [
    config.sdkKey,
    config.signature,
    config.meetingNumber,
    config.password,
    config.userName,
    config.userEmail,
    config.zak,
    onError,
  ]);

  async function leave() {
    setBusy(true);
    try {
      await clientRef.current?.leaveMeeting();
    } catch {
      // ignore
    } finally {
      setBusy(false);
      setJoined(false);
      onLeave?.();
    }
  }

  return (
    <div className="flex min-h-[480px] flex-col gap-2">
      {status ? (
        <p className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
          {status}
        </p>
      ) : null}
      <div
        ref={rootRef}
        className="min-h-[420px] flex-1 overflow-hidden rounded-xl border border-slate-200 bg-slate-950"
      />
      {joined ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void leave()}>
            Leave Zoom meeting
          </Button>
          <p className="self-center text-xs text-muted-foreground">
            Host: use Zoom toolbar for mute, screen share, participant controls.
          </p>
        </div>
      ) : null}
    </div>
  );
}
