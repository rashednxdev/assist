'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Radio, ArrowRight } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import type { MeUser } from '@/lib/auth';

interface HostingRow {
  id: string;
  topic: string;
  scheduled_at: string;
  status: string;
  is_previous?: boolean;
  exam_subject_name?: string;
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Red-and-white block for instructors/resource persons assigned as host.
 * Each row opens the live control room (`/live-room/:id`).
 * Shown whenever the user has any active host assignments (not only host-role users).
 */
export function HostClassesBlock({ me }: { me: MeUser | null }) {
  const [items, setItems] = useState<HostingRow[] | null>(null);

  useEffect(() => {
    if (!me) {
      setItems(null);
      return;
    }
    apiFetch<{ data: HostingRow[] }>('/live-streams/hosting')
      .then((res) => setItems(res.data))
      .catch(() => setItems([]));
  }, [me]);

  const active = useMemo(() => {
    const rows = items ?? [];
    return rows
      .filter((row) => !row.is_previous && row.status !== 'ended' && row.status !== 'cancelled')
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime());
  }, [items]);

  if (!me || items === null) return null;
  if (active.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-2xl border-2 border-rose-600 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-rose-600 px-4 py-3 text-white sm:px-5">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4" />
          <h2 className="text-sm font-extrabold uppercase tracking-wide">Your host classes</h2>
        </div>
        <Link
          href="/live/hosting"
          className="inline-flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white"
        >
          Hosting desk
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <ul className="divide-y divide-rose-100">
        {active.map((item) => {
          const live = item.status === 'live';
          return (
            <li key={item.id}>
              <Link
                href={`/live-room/${item.id}`}
                target="_blank"
                rel="noreferrer"
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 transition hover:bg-rose-50/70 sm:px-5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {live ? (
                      <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white">
                        LIVE
                      </span>
                    ) : (
                      <span className="rounded-full border border-rose-200 bg-white px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700">
                        {item.status}
                      </span>
                    )}
                    <p className="truncate text-sm font-bold text-[#0a2f5b]">{item.topic}</p>
                  </div>
                  <p className="mt-0.5 text-xs font-medium text-slate-600">
                    {[formatWhen(item.scheduled_at), item.exam_subject_name].filter(Boolean).join(' · ')}
                  </p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white">
                  Open host page
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
