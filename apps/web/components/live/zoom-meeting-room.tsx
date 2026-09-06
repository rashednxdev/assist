'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export interface ZoomMeetingJoinConfig {
  /** Zoom Web Client URL from API (S2S) — mic, camera, screen share. */
  webClientUrl: string;
  meetingNumber: string;
  password?: string;
  userName: string;
  role: 'host' | 'audience';
  /** Optional — unused when joining via web client. */
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

/**
 * Opens Zoom’s official Web Client (works with Server-to-Server OAuth only).
 * Includes two-way AV and screen share in Zoom’s UI — no Meeting SDK JWT.
 * Zoom blocks embedding in iframes, so we open a dedicated window / tab.
 */
export function ZoomMeetingRoom({ config, onError, onLeave }: ZoomMeetingRoomProps) {
  const [opened, setOpened] = useState(false);
  const [popupBlocked, setPopupBlocked] = useState(false);

  useEffect(() => {
    if (!config.webClientUrl) {
      onError?.('Zoom join URL missing from server.');
      return;
    }
    const win = window.open(
      config.webClientUrl,
      'proassist-zoom',
      'noopener,noreferrer,width=1280,height=800',
    );
    if (!win) {
      setPopupBlocked(true);
      setOpened(false);
      return;
    }
    setPopupBlocked(false);
    setOpened(true);
  }, [config.webClientUrl, onError]);

  function openAgain() {
    const win = window.open(
      config.webClientUrl,
      'proassist-zoom',
      'noopener,noreferrer,width=1280,height=800',
    );
    if (!win) {
      setPopupBlocked(true);
      onError?.('Popup blocked — allow popups for this site, then try again.');
      return;
    }
    setPopupBlocked(false);
    setOpened(true);
  }

  return (
    <div className="flex min-h-[280px] flex-col gap-3 rounded-xl border border-sky-100 bg-sky-50/80 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {config.role === 'host' ? 'Zoom host classroom' : 'Zoom classroom'}
        </p>
        {config.userName?.trim() ? (
          <p className="mt-1 text-sm font-medium text-slate-800">
            Signed in as: {config.userName.trim()}
            {config.role === 'host' ? ' (host)' : ' (guest)'}
          </p>
        ) : null}
        <p className="mt-1 text-sm text-slate-600">
          Opens Zoom Web Client with mic, camera, and screen share. Keep this tab open for
          messages and session controls.
        </p>
      </div>

      {popupBlocked ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Popup was blocked. Click the button below (or allow popups for this site).
        </p>
      ) : null}

      {opened && !popupBlocked ? (
        <p className="text-sm text-emerald-800">
          Zoom window opened. Use Zoom’s toolbar for mute, video, and <strong>Share Screen</strong>.
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => openAgain()}>
          {opened ? 'Re-open Zoom window' : 'Open Zoom classroom'}
        </Button>
        <Button asChild variant="outline">
          <a href={config.webClientUrl} target="_blank" rel="noreferrer">
            Open in new tab
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setOpened(false);
            onLeave?.();
          }}
        >
          Leave (close here)
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Meeting {config.meetingNumber}
        {config.password ? ` · pwd set` : ''} · {config.userName}
      </p>
    </div>
  );
}
