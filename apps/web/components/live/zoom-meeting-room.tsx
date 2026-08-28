'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
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

/**
 * Zoom Meeting SDK runs inside an iframe with Zoom’s own React 18 bundles.
 * The host Next.js app uses React 19 — importing @zoom/meetingsdk directly
 * causes “Cannot read properties of undefined (reading 'ReactCurrentOwner')”.
 */
function buildZoomIframeHtml(config: ZoomMeetingJoinConfig): string {
  const payload = JSON.stringify({
    sdkKey: config.sdkKey,
    signature: config.signature,
    meetingNumber: config.meetingNumber,
    password: config.password,
    userName: config.userName,
    userEmail: config.userEmail ?? '',
    zak: config.zak ?? '',
  });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Zoom meeting</title>
  <style>
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; height: 100%; background: #020617; color: #e2e8f0; font-family: system-ui, sans-serif; overflow: hidden; }
    #status {
      position: absolute; left: 12px; right: 12px; top: 12px; z-index: 20;
      padding: 10px 14px; border-radius: 10px; background: rgba(15, 23, 42, 0.9);
      font-size: 13px; line-height: 1.4;
    }
    #status.ok { display: none; }
    #zmmtg-root, #meetingSDKElement { width: 100%; height: 100%; min-height: 100vh; }
  </style>
  <link rel="stylesheet" href="https://source.zoom.us/3.13.2/css/bootstrap.css" />
  <link rel="stylesheet" href="https://source.zoom.us/3.13.2/css/react-select.css" />
  <script src="https://source.zoom.us/3.13.2/lib/vendor/react.min.js"><\/script>
  <script src="https://source.zoom.us/3.13.2/lib/vendor/react-dom.min.js"><\/script>
  <script src="https://source.zoom.us/3.13.2/lib/vendor/redux.min.js"><\/script>
  <script src="https://source.zoom.us/3.13.2/lib/vendor/redux-thunk.min.js"><\/script>
  <script src="https://source.zoom.us/3.13.2/lib/vendor/lodash.min.js"><\/script>
  <script src="https://source.zoom.us/3.13.2/zoom-meeting-embedded-3.13.2.min.js"><\/script>
</head>
<body>
  <div id="status">Connecting to Zoom…</div>
  <div id="meetingSDKElement"></div>
  <script>
    (async function () {
      var cfg = ${payload};
      var statusEl = document.getElementById('status');
      function setStatus(msg, ok) {
        statusEl.textContent = msg || '';
        statusEl.className = ok ? 'ok' : '';
        try {
          parent.postMessage({ source: 'proassist-zoom', type: ok ? 'joined' : 'status', message: msg || '' }, '*');
        } catch (e) {}
      }
      try {
        if (!window.ZoomMtgEmbedded) {
          throw new Error('Zoom Meeting SDK failed to load from CDN');
        }
        var client = ZoomMtgEmbedded.createClient();
        window.__zoomClient = client;
        await client.init({
          zoomAppRoot: document.getElementById('meetingSDKElement'),
          language: 'en-US',
          patchJsMedia: true,
          leaveOnPageUnload: true,
        });
        setStatus('Joining meeting…');
        var joinOpts = {
          sdkKey: cfg.sdkKey,
          signature: cfg.signature,
          meetingNumber: String(cfg.meetingNumber),
          password: cfg.password || '',
          userName: cfg.userName || 'Guest',
        };
        if (cfg.userEmail) joinOpts.userEmail = cfg.userEmail;
        if (cfg.zak) joinOpts.zak = cfg.zak;
        await client.join(joinOpts);
        setStatus('', true);
        parent.postMessage({ source: 'proassist-zoom', type: 'joined' }, '*');
      } catch (err) {
        var msg = (err && err.message) ? err.message : 'Zoom join failed';
        setStatus(msg, false);
        try {
          parent.postMessage({ source: 'proassist-zoom', type: 'error', message: msg }, '*');
        } catch (e2) {}
      }
    })();

    window.addEventListener('message', function (ev) {
      if (!ev.data || ev.data.source !== 'proassist-zoom-host') return;
      if (ev.data.type === 'leave' && window.__zoomClient) {
        window.__zoomClient.leaveMeeting().catch(function () {});
      }
    });
  <\/script>
</body>
</html>`;
}

/** Embedded Zoom Meeting — iframe isolates Zoom’s React 18 from Next.js React 19. */
export function ZoomMeetingRoom({ config, onError, onLeave }: ZoomMeetingRoomProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState('Initializing Zoom…');
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  const html = useMemo(() => buildZoomIframeHtml(config), [
    config.sdkKey,
    config.signature,
    config.meetingNumber,
    config.password,
    config.userName,
    config.userEmail,
    config.zak,
  ]);

  useEffect(() => {
    function onMessage(ev: MessageEvent) {
      const data = ev.data;
      if (!data || data.source !== 'proassist-zoom') return;
      if (data.type === 'joined') {
        setJoined(true);
        setStatus('');
      } else if (data.type === 'error') {
        const msg = typeof data.message === 'string' ? data.message : 'Zoom join failed';
        setStatus(msg);
        onError?.(msg);
      } else if (data.type === 'status' && data.message) {
        setStatus(String(data.message));
      }
    }
    window.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('message', onMessage);
      try {
        iframeRef.current?.contentWindow?.postMessage(
          { source: 'proassist-zoom-host', type: 'leave' },
          '*',
        );
      } catch {
        // ignore
      }
    };
  }, [onError]);

  function leave() {
    setBusy(true);
    try {
      iframeRef.current?.contentWindow?.postMessage(
        { source: 'proassist-zoom-host', type: 'leave' },
        '*',
      );
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
      <iframe
        ref={iframeRef}
        title="Zoom meeting"
        srcDoc={html}
        allow="camera; microphone; display-capture; autoplay; clipboard-write"
        className="min-h-[520px] w-full flex-1 rounded-xl border border-slate-200 bg-slate-950"
      />
      {joined ? (
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => leave()}>
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
