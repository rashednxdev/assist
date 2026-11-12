'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Video, Layers, Radio } from 'lucide-react';
import type { LiveClassPackageBrief, LivePermissionStatus, LiveStreamStatus } from '@ibas/shared-types';
import { LivePackageChip } from '@/components/live/live-package-cta';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

interface LiveRow {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: LiveStreamStatus;
  host_name?: string;
  exam_subject_id?: string;
  exam_subject_name?: string;
  permission_status: LivePermissionStatus;
  can_join: boolean;
  is_previous?: boolean;
  slide_count?: number;
  presentation_count?: number;
  access_type?: 'free' | 'paid';
  packages?: LiveClassPackageBrief[];
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
              {formatWhen(item.scheduled_at)}
              {item.host_name ? ` · ${item.host_name}` : ''}
            </div>
            {item.exam_subject_name ? (
              <div className="text-xs font-medium text-pink-800">{item.exam_subject_name}</div>
            ) : null}
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
              <LivePackageChip packages={item.packages} />
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
  const [subjectFilter, setSubjectFilter] = useState('all');

  useEffect(() => {
    apiFetch<{ data: LiveRow[] }>('/live-streams?video_platform=agora')
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.exam_subject_id && item.exam_subject_name) {
        map.set(item.exam_subject_id, item.exam_subject_name);
      }
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [items]);

  const filtered = useMemo(() => {
    if (subjectFilter === 'all') return items;
    if (subjectFilter === 'none') return items.filter((i) => !i.exam_subject_id);
    return items.filter((i) => i.exam_subject_id === subjectFilter);
  }, [items, subjectFilter]);

  const { upcoming, previous } = useMemo(() => {
    const up: LiveRow[] = [];
    const prev: LiveRow[] = [];
    for (const item of filtered) {
      if (item.is_previous || item.status === 'ended' || item.status === 'cancelled') prev.push(item);
      else up.push(item);
    }
    return { upcoming: up, previous: prev };
  }, [filtered]);

  const groupedUpcoming = useMemo(() => {
    const groups = new Map<string, { key: string; title: string; items: LiveRow[] }>();
    for (const item of upcoming) {
      const key = item.exam_subject_id ?? 'none';
      const title = item.exam_subject_name ?? 'General';
      const existing = groups.get(key);
      if (existing) existing.items.push(item);
      else groups.set(key, { key, title, items: [item] });
    }
    return [...groups.values()].sort((a, b) => {
      if (a.key === 'none') return 1;
      if (b.key === 'none') return -1;
      return a.title.localeCompare(b.title);
    });
  }, [upcoming]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live class (Agora)"
        description="Browse Agora live sessions by subject. Invited guests can join live. Assigned hosts use Host live to open the control room."
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

      {!loading && items.length > 0 ? (
        <div className="max-w-sm space-y-1.5">
          <Label htmlFor="live-subject-filter">Filter by subject</Label>
          <select
            id="live-subject-filter"
            value={subjectFilter}
            onChange={(e) => setSubjectFilter(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All subjects</option>
            {subjectOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
            <option value="none">No subject</option>
          </select>
        </div>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
      {!loading && filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">No live sessions yet.</p>
      ) : null}

      {groupedUpcoming.length > 0 ? (
        <div className="space-y-6">
          <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Upcoming & live</h2>
          {groupedUpcoming.map((group) => (
            <div key={group.key} className="space-y-3">
              <h3 className="text-sm font-semibold text-slate-800">{group.title}</h3>
              <div className="grid gap-3">
                {group.items.map((item) => (
                  <ClassCard key={item.id} item={item} />
                ))}
              </div>
            </div>
          ))}
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
