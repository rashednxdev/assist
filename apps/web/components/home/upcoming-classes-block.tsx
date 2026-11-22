'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Radio, Video } from 'lucide-react';
import { toBanglaDigits } from '@/lib/bangla-format';
import { cn } from '@/lib/utils';

export interface HomeClassItem {
  id: string;
  topic: string;
  scheduled_at: string;
  status: string;
  exam_subject_name?: string;
  is_previous?: boolean;
  access_type?: 'free' | 'paid';
}

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('bn-BD', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function useNow(tickMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), tickMs);
    return () => window.clearInterval(id);
  }, [tickMs]);
  return now;
}

function countdownParts(targetIso: string, now: number): { label: string; urgent: boolean } | null {
  const diff = new Date(targetIso).getTime() - now;
  if (!Number.isFinite(diff)) return null;
  if (diff <= 0) return { label: 'এখনই', urgent: true };
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86_400);
  const hours = Math.floor((totalSec % 86_400) / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  if (days > 0) {
    return {
      label: `${bn(days)}দ ${bn(hours)}ঘ ${bn(mins)}মি`,
      urgent: days < 1,
    };
  }
  const pad = (n: number) => bn(String(n).padStart(2, '0'));
  return {
    label: `${pad(hours)}:${pad(mins)}:${pad(secs)}`,
    urgent: hours < 1,
  };
}

/**
 * Next three upcoming (or live) classes with countdown + LIVE badge.
 * Use `layout="stack"` in the Home right column above সামগ্রিক প্রস্তুতি.
 */
export function UpcomingClassesBlock({
  items,
  layout = 'grid',
  className,
}: {
  items: HomeClassItem[] | null;
  layout?: 'grid' | 'stack';
  className?: string;
}) {
  const now = useNow(1000);
  const stacked = layout === 'stack';

  const upcoming = useMemo(() => {
    const rows = items ?? [];
    return rows
      .filter((row) => {
        if (row.is_previous) return false;
        if (row.status === 'ended' || row.status === 'cancelled') return false;
        if (row.status === 'live' || row.status === 'paused') return true;
        return new Date(row.scheduled_at).getTime() >= now - 60 * 60 * 1000;
      })
      .sort((a, b) => {
        const liveRank = (s: string) => (s === 'live' ? 0 : s === 'paused' ? 1 : 2);
        const lr = liveRank(a.status) - liveRank(b.status);
        if (lr !== 0) return lr;
        return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
      })
      .slice(0, 3);
  }, [items, now]);

  if (items === null) {
    return (
      <section className={cn('space-y-2', className)}>
        <h2 className="text-sm font-bold text-[#0a2f5b]">আসন্ন ক্লাস</h2>
        <div className="h-28 animate-pulse rounded-2xl bg-slate-100" />
      </section>
    );
  }

  return (
    <section
      className={cn(
        'space-y-2 rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs sm:p-5',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold text-[#0a2f5b]">আসন্ন ক্লাস</h2>
        <Link href="/live" className="text-xs font-semibold text-[#1566b8] hover:underline">
          সব →
        </Link>
      </div>

      {upcoming.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d7e4ee] px-3 py-4 text-xs text-slate-500">
          আপাতত কোনো আসন্ন ক্লাস নেই।
        </p>
      ) : (
        <div className={cn('grid gap-2', stacked ? 'grid-cols-1' : 'md:grid-cols-3')}>
          {upcoming.map((item) => {
            const live = item.status === 'live';
            const count = live ? null : countdownParts(item.scheduled_at, now);
            return (
              <Link
                key={item.id}
                href={`/live/zoom/${item.id}`}
                className={cn(
                  'group flex items-center gap-3 rounded-xl border px-3 py-2.5 transition hover:border-[#1566b8]',
                  live
                    ? 'border-rose-300 bg-gradient-to-r from-rose-50 to-white'
                    : 'border-[#eaf0f6] bg-[#f8fbfe]',
                )}
              >
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {live ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
                        </span>
                        LIVE
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#eaf4fc] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1566b8]">
                        <Video className="h-3 w-3" />
                        Upcoming
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs font-bold text-[#0a2f5b] group-hover:text-[#1566b8]">
                    {item.topic}
                  </p>
                  <p className="text-[11px] text-slate-500">{formatWhen(item.scheduled_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  {count ? (
                    <p
                      className={cn(
                        'font-mono text-xs font-extrabold tabular-nums',
                        count.urgent ? 'text-rose-600' : 'text-[#0a2f5b]',
                      )}
                    >
                      {count.label}
                    </p>
                  ) : live ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700">
                      <Radio className="h-3.5 w-3.5" />
                      Join
                    </span>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
