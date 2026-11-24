'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
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
 * Zoom blocks embedding in iframes, so the classroom opens in a dedicated window/tab.
 */
export function ZoomMeetingRoom({ config, onError, onLeave }: ZoomMeetingRoomProps) {
  const popupRef = useRef<Window | null>(null);
  const [status, setStatus] = useState<RoomStatus>('joining');
  const [hint, setHint] = useState('Opening Zoom classroom…');
  const [popupBlocked, setPopupBlocked] = useState(false);

  function openClassroom() {
    const url = config.webClientUrl?.trim();
    if (!url) return false;
    try {
      popupRef.current?.close();
    } catch {
      /* ignore */
    }
    const win = window.open(url, 'proassist-zoom-class', 'noopener,noreferrer');
    popupRef.current = win;
    if (!win) {
      setPopupBlocked(true);
      setStatus('error');
      setHint('Browser blocked the Zoom window. Allow pop-ups for this site, then click Open Zoom classroom.');
      onError?.('Browser blocked the Zoom classroom window.');
      return false;
    }
    setPopupBlocked(false);
    setStatus('live');
    setHint(
      config.role === 'host'
        ? 'Zoom classroom opened in a new window. Keep that window open while hosting. One device only (web or mobile).'
        : 'Zoom classroom opened in a new window. Keep that window open to stay in class. One device only (web or mobile).',
    );
    return true;
  }

  useEffect(() => {
    if (!config.webClientUrl?.trim()) {
      const message =
        'Classroom join URL is missing. Set ZOOM_ACCOUNT_ID, ZOOM_CLIENT_ID, and ZOOM_CLIENT_SECRET on the API.';
      setStatus('error');
      setHint(message);
      onError?.(message);
      return;
    }
    openClassroom();
    return () => {
      try {
        popupRef.current?.close();
      } catch {
        /* ignore */
      }
      popupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.webClientUrl, config.role, config.meetingNumber]);

  return (
    <div className="flex min-h-[280px] flex-col gap-3 rounded-xl border border-emerald-100 bg-slate-950 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 px-1">
        <div>
          <p className="text-sm font-semibold text-white">
            {config.role === 'host' ? 'Hosting in Zoom' : 'Joined in Zoom'}
          </p>
          <p className="mt-0.5 text-xs text-white/70">
            {config.userName?.trim()
              ? `Signed in as ${config.userName.trim()}${config.role === 'host' ? ' (host)' : ''}`
              : 'Display name set automatically'}
          </p>
          <p className="mt-1 text-xs text-emerald-200/90">{hint}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="border-emerald-300/40 bg-emerald-500/20 text-white hover:bg-emerald-500/30"
            onClick={() => openClassroom()}
          >
            <ExternalLink className="h-4 w-4" />
            Open Zoom classroom
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/20 bg-white/10 text-white hover:bg-white/20"
            onClick={() => {
              try {
                popupRef.current?.close();
              } catch {
                /* ignore */
              }
              popupRef.current = null;
              onLeave?.();
            }}
          >
            Leave class
          </Button>
        </div>
      </div>

      {status === 'joining' ? (
        <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/90">
          <Loader2 className="h-4 w-4 animate-spin" />
          Opening Zoom classroom window…
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="rounded-lg border border-rose-300/40 bg-rose-950/50 px-3 py-2 text-sm text-rose-100">
          {hint}
          {popupBlocked && config.webClientUrl ? (
            <p className="mt-2">
              Or open directly:{' '}
              <a className="underline" href={config.webClientUrl} target="_blank" rel="noreferrer">
                Zoom classroom link
              </a>
            </p>
          ) : null}
        </div>
      ) : null}

      {status === 'live' ? (
        <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-3 text-sm text-white/80">
          Zoom does not allow the classroom inside this page (iframe blocked). Use the Zoom window that opened.
          If you closed it, click <span className="font-semibold text-white">Open Zoom classroom</span> again.
        </div>
      ) : null}

      <p className="px-1 text-[11px] text-white/45">
        Meeting {config.meetingNumber}
        {config.password ? ' · password set' : ''} · one device (web or mobile)
      </p>
    </div>
  );
}
