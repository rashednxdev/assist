'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ZoomMeetingJoinConfig {
  /** Kept for compatibility; in-browser SDK join is preferred. */
  webClientUrl?: string;
  meetingNumber: string;
  password?: string;
  userName: string;
  role: 'host' | 'audience';
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
 * In-browser Zoom classroom (Meeting SDK Component View).
 * Host/guest stay on ProAssist — no Zoom login redirect.
 * Display name comes from the API; mic starts muted; camera stays off until the user turns it on.
 */
export function ZoomMeetingRoom({ config, onError, onLeave }: ZoomMeetingRoomProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<{
    leaveMeeting: (userId?: number) => Promise<unknown>;
    endMeeting?: () => Promise<unknown>;
    mute: (mute: boolean, userId?: number) => Promise<unknown>;
    stopAudio?: () => Promise<unknown>;
  } | null>(null);
  const [status, setStatus] = useState<RoomStatus>('joining');
  const [hint, setHint] = useState('Connecting classroom… Browser may ask for microphone / camera access.');

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!config.sdkKey?.trim() || !config.signature?.trim()) {
        const message =
          'In-browser class needs ZOOM_SDK_KEY and ZOOM_SDK_SECRET on the API (Meeting SDK app). Zoom login redirect is disabled.';
        setStatus('error');
        setHint(message);
        onError?.(message);
        return;
      }
      if (!rootRef.current) return;

      try {
        const ZoomMtgEmbedded = (await import('@zoom/meetingsdk/embedded')).default;
        const client = ZoomMtgEmbedded.createClient();
        clientRef.current = client as typeof clientRef.current;

        await client.init({
          zoomAppRoot: rootRef.current,
          language: 'en-US',
          patchJsMedia: true,
          leaveOnPageUnload: true,
          customize: {
            video: {
              isResizable: true,
              viewSizes: {
                default: { width: 960, height: 540 },
              },
            },
            meetingInfo: ['topic', 'host', 'mn', 'pwd', 'participant'],
          },
        });
        if (cancelled) return;

        await client.join({
          sdkKey: config.sdkKey,
          signature: config.signature,
          meetingNumber: String(config.meetingNumber).replace(/\s+/g, ''),
          password: config.password || '',
          userName: config.userName.trim() || (config.role === 'host' ? 'Host' : 'Guest'),
          userEmail: config.userEmail,
          ...(config.role === 'host' && config.zak ? { zak: config.zak } : {}),
        });
        if (cancelled) return;

        // Default: mic muted, camera off (meeting settings also force mute-on-entry / no auto video).
        try {
          await client.mute(true);
        } catch {
          /* already muted / audio not joined yet */
        }
        try {
          await client.stopAudio?.();
        } catch {
          /* optional */
        }

        if (!cancelled) {
          setStatus('live');
          setHint(
            config.role === 'host'
              ? 'You are hosting inside ProAssist. Mic and camera start off — turn them on when ready.'
              : 'Joined inside ProAssist. Mic and camera start off — allow browser access only if you unmute.',
          );
        }
      } catch (err) {
        if (cancelled) return;
        const message =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err && 'reason' in err
              ? String((err as { reason?: string }).reason)
              : 'Could not open the classroom in the browser.';
        setStatus('error');
        setHint(message);
        onError?.(message);
      }
    }

    void start();

    return () => {
      cancelled = true;
      const client = clientRef.current;
      clientRef.current = null;
      if (client) {
        void client.leaveMeeting().catch(() => undefined);
      }
      void import('@zoom/meetingsdk/embedded')
        .then((mod) => {
          mod.default.destroyClient?.();
        })
        .catch(() => undefined);
    };
    // Re-join only when the meeting identity changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.meetingNumber, config.signature, config.sdkKey, config.role, config.zak, config.userName]);

  async function leave() {
    try {
      if (config.role === 'host' && clientRef.current?.endMeeting) {
        await clientRef.current.endMeeting();
      } else {
        await clientRef.current?.leaveMeeting();
      }
    } catch {
      /* ignore */
    }
    clientRef.current = null;
    onLeave?.();
  }

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
          onClick={() => void leave()}
        >
          Leave class
        </Button>
      </div>

      {status === 'joining' ? (
        <div className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/90">
          <Loader2 className="h-4 w-4 animate-spin" />
          Joining automatically — only mic/camera permission may appear…
        </div>
      ) : null}

      {status === 'error' ? (
        <div className="rounded-lg border border-rose-300/40 bg-rose-950/50 px-3 py-2 text-sm text-rose-100">
          {hint}
        </div>
      ) : null}

      <div
        ref={rootRef}
        id="proassist-zoom-root"
        className="min-h-[360px] w-full flex-1 overflow-hidden rounded-lg bg-black sm:min-h-[480px]"
      />

      <p className="px-1 text-[11px] text-white/45">
        Meeting {config.meetingNumber}
        {config.password ? ' · password set' : ''} · one device at a time
      </p>
    </div>
  );
}
