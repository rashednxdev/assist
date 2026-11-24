'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ZoomMeetingJoinConfig {
  /** Zoom Web Client URL from Server-to-Server OAuth (host start + guest join). */
  webClientUrl?: string;
  meetingNumber: string;
  password?: string;
  userName: string;
  role: 'host' | 'audience';
  /** Optional Meeting SDK fields — not required for browser host/join. */
  sdkKey?: string;
  signature?: string;
  zak?: string;
  userEmail?: string;
}

interface ZoomMeetingRoomProps {
  config: ZoomMeetingJoinConfig;
  onError?: (message: string) => void;
  onLeave?: () => void;
}

type RoomStatus = 'joining' | 'live' | 'error';

/**
 * Browser host/join via Zoom Web Client (Server-to-Server OAuth).
 * Same path that worked before — General App / Meeting SDK is not required.
 */
export function ZoomMeetingRoom({ config, onError, onLeave }: ZoomMeetingRoomProps) {
  const [status, setStatus] = useState<RoomStatus>('joining');
  const [hint, setHint] = useState('Opening Zoom classroom…');

  useEffect(() => {
    if (!config.webClientUrl?.trim()) {
      const message =
        'Classroom join URL is missing. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET on the API.';
      setStatus('error');
      setHint(message);
      onError?.(message);
      return;
    }
    setStatus('live');
    setHint(
      config.role === 'host'
        ? 'Hosting in browser via Zoom web classroom. One device only (web or mobile).'
        : 'Joined in browser via Zoom web classroom. One device only (web or mobile).',
    );
  }, [config.webClientUrl, config.role, onError]);

  return (
    <div className="flex min-h-[420px] flex-col gap-3 rounded-xl border border-emerald-100 bg-slate-950 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <div>
          <p className="text-sm font-semibold text-white">
            {config.role === 'host' ? 'Hosting in ProAssist' : 'Joined in ProAssist'}
          </p>
          <p className="mt-0.5 text-xs text-white/70">
            {config.userName?.trim()
              ? `Signed in as ${config.userName.trim()}${config.role === 'host' ? ' (host)' : ''}`
              : 'Display name set automatically'}
          </p>
          <p className="mt-1 text-xs text-emerald-200/90">{hint}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-white/20 bg-white/10 text-white hover:bg-white/20"
          onClick={() => onLeave?.()}
        >
          Leave class
        </Button>
      </div>

      {status === 'joining' ? (
        <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/90">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening classroom…
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="rounded-lg border border-rose-300/40 bg-rose-950/50 px-3 py-2 text-sm text-rose-100">
          {hint}
        </div>
      ) : null}

      {config.webClientUrl ? (
        <iframe
          title="ProAssist live class"
          src={config.webClientUrl}
          allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
          className="min-h-[360px] w-full flex-1 rounded-lg border-0 bg-black sm:min-h-[480px]"
        />
      ) : null}

      <p className="px-1 text-[11px] text-white/45">
        Meeting {config.meetingNumber}
        {config.password ? ' · password set' : ''} · one device (web or mobile)
      </p>
    </div>
  );
}
