'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  recordedContentPlayback,
  recordedContentSource,
  type LiveStreamRecordedContent,
} from '@ibas/shared-types';

function tryUnlockZoomPasscode(passcode: string) {
  const code = passcode.trim();
  if (!code || typeof document === 'undefined') return;
  const inputs = document.querySelectorAll<HTMLInputElement>(
    'input[type="password"], input[name*="pass" i], input[id*="pass" i]',
  );
  let filled = false;
  inputs.forEach((el) => {
    if (el.disabled) return;
    el.focus();
    el.value = code;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    filled = true;
  });
  if (!filled) return;
  const buttons = Array.from(
    document.querySelectorAll<HTMLElement>('button, input[type="submit"], a[role="button"]'),
  );
  for (const b of buttons) {
    const t = `${b.textContent ?? ''} ${(b as HTMLInputElement).value ?? ''} ${
      b.getAttribute('aria-label') ?? ''
    }`.toLowerCase();
    if (/view|watch|submit|continue|access|play|unlock|enter/.test(t)) {
      b.click();
      return;
    }
  }
}

export function LiveClassRecordedVideos({
  items,
}: {
  items: LiveStreamRecordedContent[];
  classTopic?: string;
}) {
  const [active, setActive] = useState(0);
  const valid = useMemo(
    () =>
      items
        .map((item) => {
          const playback = recordedContentPlayback(item);
          if (!playback) return null;
          return {
            title: item.title?.trim() || '',
            source: recordedContentSource(item),
            passcode: (item.passcode ?? '').trim(),
            playback,
          };
        })
        .filter((x): x is NonNullable<typeof x> => x != null),
    [items],
  );

  const current = valid[Math.min(active, Math.max(valid.length - 1, 0))];

  useEffect(() => {
    if (!current || current.source !== 'zoom' || !current.passcode) return;
    const t1 = window.setTimeout(() => tryUnlockZoomPasscode(current.passcode), 500);
    const t2 = window.setTimeout(() => tryUnlockZoomPasscode(current.passcode), 1500);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [current?.playback.src, current?.passcode, current?.source]);

  if (valid.length === 0) {
    return <p className="text-sm text-muted-foreground">No recorded videos published yet.</p>;
  }

  const playing = current!;

  return (
    <div className="space-y-3">
      {valid.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          {valid.map((item, index) => (
            <button
              key={`${item.playback.src}-${index}`}
              type="button"
              className={`rounded-xl border px-3 py-1.5 text-sm font-semibold ${
                index === active
                  ? 'border-pink-300 bg-pink-50 text-pink-900'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
              onClick={() => setActive(index)}
            >
              {item.title || `Part ${index + 1}`}
            </button>
          ))}
        </div>
      ) : null}
      <div
        className="aspect-video overflow-hidden rounded-2xl bg-slate-950 select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        {playing.playback.kind === 'html5' ? (
          <video
            className="h-full w-full"
            controls
            playsInline
            controlsList="nodownload noremoteplayback noplaybackrate"
            disablePictureInPicture
            onContextMenu={(e) => e.preventDefault()}
            src={playing.playback.src}
          />
        ) : (
          <iframe
            title={playing.title || 'Recorded class'}
            src={playing.playback.src}
            className="h-full w-full border-0"
            allow="accelerometer; autoplay; encrypted-media; gyroscope; fullscreen"
            allowFullScreen
            referrerPolicy="no-referrer"
          />
        )}
      </div>
    </div>
  );
}
