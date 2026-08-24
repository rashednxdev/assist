'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Radio, Video } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';

interface HostingRow {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: string;
  is_previous?: boolean;
}

function openLiveRoom(sessionId: string) {
  window.open(`/live-room/${sessionId}`, '_blank', 'noopener,noreferrer');
}

function statusClass(status: string) {
  if (status === 'live') return 'bg-emerald-50 text-emerald-800 border-emerald-100';
  if (status === 'paused') return 'bg-amber-50 text-amber-800 border-amber-100';
  if (status === 'ended' || status === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200';
  return 'bg-sky-50 text-sky-800 border-sky-100';
}

export default function LiveHostingPage() {
  const [items, setItems] = useState<HostingRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: HostingRow[] }>('/live-streams/hosting')
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const { active, previous } = useMemo(() => {
    const act: HostingRow[] = [];
    const prev: HostingRow[] = [];
    for (const item of items) {
      if (item.is_previous || item.status === 'ended' || item.status === 'cancelled') prev.push(item);
      else act.push(item);
    }
    return { active: act, previous: prev };
  }, [items]);

  function HostCard({ item }: { item: HostingRow }) {
    return (
      <Card className="border-pink-100 bg-pink-50/40">
        <CardContent className="flex flex-wrap items-start gap-3 pt-6">
          <div className="rounded-xl bg-pink-100 p-2.5 text-pink-800">
            <Radio className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="font-semibold text-slate-900">{item.topic}</div>
            <div className="text-sm text-slate-500">{new Date(item.scheduled_at).toLocaleString()}</div>
            <span
              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${statusClass(item.status)}`}
            >
              {item.status}
            </span>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button type="button" onClick={() => openLiveRoom(item.id)}>
              <Radio className="h-4 w-4" />
              Open control room
            </Button>
            <Button asChild variant="outline">
              <Link href={`/live-room/${item.id}`} target="_blank" rel="noreferrer">
                New tab
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Host live classes"
        description="Classes assigned to you as host. Open the control room to go live, share screen, manage guests, and messages."
      />
      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && items.length === 0 ? (
        <Card>
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-muted-foreground">
            <Video className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <p>
              No classes assigned to you as host yet. An admin can set you as the session host from
              Live class admin.
            </p>
          </CardContent>
        </Card>
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Your classes</h2>
          <div className="grid gap-3">
            {active.map((item) => (
              <HostCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : null}

      {previous.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Previous</h2>
          <div className="grid gap-3">
            {previous.map((item) => (
              <HostCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
