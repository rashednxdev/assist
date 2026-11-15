'use client';

import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Shows a loader the instant a person presses a link, tab, or button,
 * and keeps it up while the work from that press is still running.
 */
export function NavigationFeedback() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const inflight = useRef(0);
  const linkWait = useRef(false);
  const shown = useRef(false);
  const armUntil = useRef(0);
  const hideTimer = useRef(0);

  useEffect(() => {
    const show = () => {
      shown.current = true;
      setVisible(true);
    };
    const hide = () => {
      shown.current = false;
      linkWait.current = false;
      setVisible(false);
    };
    const scheduleHide = () => {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        if (inflight.current === 0 && !linkWait.current) hide();
      }, 280);
    };
    const arm = (ms = 2000) => {
      armUntil.current = Date.now() + ms;
      show();
      scheduleHide();
    };

    const original = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const track = shown.current || Date.now() < armUntil.current;
      if (track) {
        inflight.current += 1;
        armUntil.current = Date.now() + 2000;
        window.clearTimeout(hideTimer.current);
        show();
      }
      return original(input, init).finally(() => {
        if (!track) return;
        inflight.current = Math.max(0, inflight.current - 1);
        if (inflight.current === 0) scheduleHide();
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const hit = target.closest('a[href], button, [role="button"], [role="tab"], select, summary');
      if (!hit || hit.closest('[data-no-loader]')) return;
      if (hit instanceof HTMLAnchorElement) {
        const href = hit.getAttribute('href') ?? '';
        if (
          !href ||
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          hit.target === '_blank' ||
          hit.hasAttribute('download')
        ) {
          return;
        }
        let next: URL;
        try {
          next = new URL(href, window.location.href);
        } catch {
          return;
        }
        if (next.origin !== window.location.origin) return;
        if (next.pathname === window.location.pathname && next.search === window.location.search) return;
        arm(8000);
        window.setTimeout(() => {
          if (!linkWait.current && inflight.current === 0) scheduleHide();
        }, 500);
        return;
      }
      arm();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const hit = target.closest('a[href]');
      if (!(hit instanceof HTMLAnchorElement)) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || hit.target === '_blank') return;
      linkWait.current = true;
      armUntil.current = Date.now() + 8000;
      show();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('click', onClick, true);
    return () => {
      window.fetch = original;
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('click', onClick, true);
      window.clearTimeout(hideTimer.current);
    };
  }, []);

  useEffect(() => {
    linkWait.current = false;
    if (inflight.current === 0) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = window.setTimeout(() => {
        if (inflight.current === 0 && !linkWait.current) {
          shown.current = false;
          setVisible(false);
        }
      }, 280);
    }
  }, [pathname]);

  if (!visible) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[80]" role="status" aria-live="polite">
      <div className="h-1 overflow-hidden bg-[#d6e6f2]">
        <div className="nav-progress-bar h-full bg-[#0f5c8c]" />
      </div>
      <div className="flex justify-center">
        <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-[#0f5c8c] px-3 py-1.5 text-xs font-semibold text-white shadow-lg">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/35 border-t-white" />
          Loading…
        </div>
      </div>
    </div>
  );
}
