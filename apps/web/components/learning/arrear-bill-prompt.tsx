'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calculator, X } from 'lucide-react';
import { ARREAR_PROMPT_SESSION_KEY } from '@/lib/arrear-prompt';
import { Button } from '@/components/ui/button';

const VISIBLE_MS = 20000;
const SLIDE_MS = 300;

/**
 * Side prompt on Home: "Do you want to calculate your arrear bill?"
 * Shows once per browsing session for 20 seconds (Yes opens the calculator, No closes it).
 */
export function ArrearBillPrompt() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const timers = useRef<number[]>([]);

  function clearTimers() {
    timers.current.forEach((id) => window.clearTimeout(id));
    timers.current = [];
  }

  function dismiss() {
    clearTimers();
    setOpen(false);
    timers.current.push(window.setTimeout(() => setMounted(false), SLIDE_MS));
  }

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(ARREAR_PROMPT_SESSION_KEY)) return;
    } catch {
      return;
    }
    setMounted(true);
    // The "already shown" flag is written when the panel really appears, so a dev double-mount
    // (or leaving the page instantly) does not swallow the prompt.
    timers.current.push(
      window.setTimeout(() => {
        try {
          window.sessionStorage.setItem(ARREAR_PROMPT_SESSION_KEY, '1');
        } catch {
          /* ignore */
        }
        setOpen(true);
      }, 50),
    );
    timers.current.push(window.setTimeout(dismiss, VISIBLE_MS));
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!mounted) return null;

  return (
    <aside
      role="dialog"
      aria-live="polite"
      aria-label="Arrear bill"
      className={`fixed right-0 top-24 z-50 w-[min(94vw,30rem)] overflow-hidden rounded-l-3xl border border-r-0 border-[#d7e4ee] bg-white shadow-2xl transition-transform duration-300 ease-out print:hidden ${
        open ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#eaf4fc] text-[#1566b8]">
            <Calculator className="h-7 w-7" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-extrabold text-[#0a2f5b]">বকেয়া বিল হিসাব</p>
            <p className="mt-1.5 text-base leading-relaxed text-slate-600">
              আপনি কি আপনার বকেয়া বিল হিসাব করতে চান?
            </p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-6 flex gap-3">
          <Button
            type="button"
            className="h-12 flex-1 rounded-xl bg-[#1566b8] text-base font-bold hover:bg-[#0f5294]"
            onClick={() => {
              clearTimers();
              router.push('/salary');
            }}
          >
            Yes
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-12 flex-1 rounded-xl border-[#d7e4ee] text-base font-bold text-[#0a2f5b]"
            onClick={dismiss}
          >
            No
          </Button>
        </div>
      </div>
      <div className="h-1.5 w-full bg-[#eaf4fc]">
        <div
          className="h-full bg-[#1566b8] transition-[width] ease-linear"
          style={{ width: open ? '0%' : '100%', transitionDuration: `${VISIBLE_MS}ms` }}
        />
      </div>
    </aside>
  );
}
