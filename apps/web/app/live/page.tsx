'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Video, Layers, Radio } from 'lucide-react';
import type { LivePermissionStatus, LiveStreamStatus } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface LiveRow {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: LiveStreamStatus;
  host_name?: string;
  permission_status: LivePermissionStatus;
  can_join: boolean;
  is_previous?: boolean;
  slide_count?: number;
  presentation_count?: number;
  access_type?: 'free' | 'paid';
}

function permissionLabel(status: LivePermissionStatus) {
  if (status === 'host') return 'Host / admin';
  if (status === 'permitted') return 'You are permitted';
  return 'Not permitted';
}

function permissionClass(status: LivePermissionStatus) {
  if (status === 'not_permitted') return 'bg-rose-50 text-rose-700 border-rose-100';
  if (status === 'host') return 'bg-amber-50 text-amber-800 border-amber-100';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100';
}

function ClassCard({ item, previous }: { item: LiveRow; previous?: boolean }) {
  return (
    <Link key={item.id} href={`/live/${item.id}`}>
      <Card
        className={`transition hover:border-pink-200 hover:shadow-sm ${previous ? 'border-pink-100 bg-pink-50/30' : ''}`}
      >
        <CardContent className="flex items-start gap-3 pt-6">
          <div className="rounded-xl bg-pink-50 p-2.5 text-pink-700">
            {previous ? <Layers className="h-5 w-5" /> : <Video className="h-5 w-5" />}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="font-semibold text-slate-900">{item.topic}</div>
            <div className="text-sm text-slate-500">
              {new Date(item.scheduled_at).toLocaleString()}
              {item.host_name ? ` · ${item.host_name}` : ''}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                {previous ? 'Previous' : item.status}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${
                  item.access_type === 'paid'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-800'
                }`}
              >
                {item.access_type === 'paid' ? 'Paid' : 'Free'}
              </span>
              {!previous ? (
                <span
                  className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${permissionClass(item.permission_status)}`}
                >
                  {permissionLabel(item.permission_status)}
                </span>
              ) : null}
              {(item.presentation_count ?? 0) > 1 ? (
                <span className="rounded-full border border-pink-100 bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-800">
                  {item.presentation_count} presentations
                </span>
              ) : (item.slide_count ?? 0) > 0 ? (
                <span className="rounded-full border border-pink-100 bg-pink-50 px-2 py-0.5 text-[11px] font-bold text-pink-800">
                  {item.slide_count} slide{(item.slide_count ?? 0) === 1 ? '' : 's'}
                </span>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function LiveStreamUserListPage() {
  const [items, setItems] = useState<LiveRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: LiveRow[] }>('/live-streams?video_platform=agora')
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const { upcoming, previous } = useMemo(() => {
    const up: LiveRow[] = [];
    const prev: LiveRow[] = [];
    for (const item of items) {
      if (item.is_previous || item.status === 'ended' || item.status === 'cancelled') prev.push(item);
      else up.push(item);
    }
    return { upcoming: up, previous: prev };
  }, [items]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live class (Agora)"
        description="Browse Agora live sessions. Invited guests can join live. Assigned hosts use Host live to open the control room."
      />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/live/zoom">
            Zoom class
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/live/hosting">
            <Radio className="h-3.5 w-3.5" />
            Host live classes
          </Link>
        </Button>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && items.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live sessions yet.</p>
      ) : null}

      {upcoming.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Upcoming & live</h2>
          <div className="grid gap-3">
            {upcoming.map((item) => (
              <ClassCard key={item.id} item={item} />
            ))}
          </div>
        </div>
      ) : null}

      {previous.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Previous class</h2>
          <div className="grid gap-3">
            {previous.map((item) => (
              <ClassCard key={item.id} item={item} previous />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
