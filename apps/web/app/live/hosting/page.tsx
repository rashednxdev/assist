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
  exam_subject_name?: string;
  host_name?: string;
}

interface HostProfile {
  id: string;
  display_name: string;
  bio?: string;
  is_active: boolean;
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

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LiveHostingPage() {
  const [items, setItems] = useState<HostingRow[]>([]);
  const [hostProfile, setHostProfile] = useState<HostProfile | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: HostingRow[]; meta?: { host_profile?: HostProfile | null } }>(
      '/live-streams/hosting?video_platform=agora',
    )
      .then((res) => {
        setItems(res.data);
        setHostProfile(res.meta?.host_profile ?? null);
      })
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
            <div className="text-sm font-medium text-slate-700">{formatWhen(item.scheduled_at)}</div>
            {item.exam_subject_name ? (
              <div className="text-xs font-medium text-pink-800">{item.exam_subject_name}</div>
            ) : null}
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

  const isListedHost = Boolean(hostProfile);
  const emptyMessage = isListedHost
    ? 'You are a listed host, but no Agora classes are assigned to you yet. An admin can schedule a class with you as host.'
    : 'No classes assigned to you as host yet. An admin can add you under Live hosts and assign you on a session.';

  return (
    <div className="space-y-6">
      <PageHeader
        title="Host live classes (Agora)"
        description="Your hosting schedule. Open the control room to go live, share screen, manage guests, and messages."
      />

      {hostProfile ? (
        <Card className="border-pink-100">
          <CardContent className="space-y-1 pt-6">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">Listed host</div>
            <div className="text-lg font-semibold text-slate-900">{hostProfile.display_name}</div>
            {hostProfile.bio ? <p className="text-sm text-slate-600">{hostProfile.bio}</p> : null}
            {!hostProfile.is_active ? (
              <p className="text-xs font-medium text-amber-700">
                Your host profile is inactive — ask an admin to reactivate it for new assignments.
              </p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && items.length === 0 ? (
        <Card>
          <CardContent className="flex items-start gap-3 pt-6 text-sm text-muted-foreground">
            <Video className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <p>{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : null}

      {active.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Your schedule</h2>
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
