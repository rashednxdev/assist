'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Layers, PlayCircle, Radio, Sparkles, Video } from 'lucide-react';
import type {
  ExamPrepPartsResponse,
  LiveClassPackageBrief,
  LivePermissionStatus,
  LiveStreamStatus,
} from '@ibas/shared-types';
import { LivePackageChip } from '@/components/live/live-package-cta';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { toBanglaDigits } from '@/lib/bangla-format';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface LiveRow {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: LiveStreamStatus;
  host_name?: string;
  support_name?: string;
  exam_subject_id?: string;
  exam_subject_name?: string;
  permission_status: LivePermissionStatus;
  can_join: boolean;
  is_previous?: boolean;
  slide_count?: number;
  presentation_count?: number;
  recorded_content_count?: number;
  access_type?: 'free' | 'paid';
  packages?: LiveClassPackageBrief[];
}

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function permissionLabel(status: LivePermissionStatus, _accessType?: 'free' | 'paid') {
  if (status === 'host') return 'হোস্ট / অ্যাডমিন';
  return 'সবাই যোগ দিতে পারবেন';
}

function permissionClass(status: LivePermissionStatus, _accessType?: 'free' | 'paid') {
  if (status === 'host') return 'border-amber-200 bg-amber-50 text-amber-800';
  return 'border-[#bde5d4] bg-[#e8f8ef] text-[#156f4d]';
}

function statusLabel(status: LiveStreamStatus, previous?: boolean) {
  if (previous || status === 'ended') return 'সম্পন্ন ক্লাস';
  if (status === 'live') return 'সরাসরি চলছে';
  if (status === 'paused') return 'বিরতি চলছে';
  if (status === 'cancelled') return 'বাতিল';
  return 'নির্ধারিত';
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return toBanglaDigits(
    d.toLocaleString('bn-BD', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }),
  );
}

function ClassCard({ item, previous }: { item: LiveRow; previous?: boolean }) {
  const isFree = item.access_type !== 'paid';
  const isLive = item.status === 'live' && !previous;

  return (
    <Link
      href={`/live/zoom/${item.id}`}
      className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 transition hover:shadow-md sm:flex-row sm:items-center ${
        isLive
          ? 'border-[#1566b8] bg-[#f4f9fd]'
          : previous
            ? 'border-[#d7e4ee] bg-white/90 hover:border-[#7eb6ea]'
            : 'border-[#d7e4ee] bg-white hover:border-[#1566b8]'
      }`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            isLive
              ? 'bg-[#1566b8] text-white'
              : previous
                ? 'bg-[#eaf3fc] text-[#0a2f5b]'
                : isFree
                  ? 'bg-[#e6f6f8] text-[#0e7490]'
                  : 'bg-[#0a2f5b] text-white'
          }`}
        >
          {previous ? <Layers className="h-5 w-5" /> : <Video className="h-5 w-5" />}
        </div>

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            {isLive ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1566b8] px-2.5 py-0.5 text-[11px] font-bold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-300" />
                LIVE
              </span>
            ) : (
              <span className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-[11px] font-semibold text-[#0a2f5b]">
                {statusLabel(item.status, previous)}
              </span>
            )}

            <span
              className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                isFree
                  ? 'border-[#9fe0e8] bg-[#e6f6f8] text-[#0e7490]'
                  : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              {isFree ? 'ফ্রি ক্লাস · সবার জন্য উন্মুক্ত' : 'পেইড ক্লাস'}
            </span>

            <LivePackageChip packages={item.packages} />
          </div>

          <p className="text-base font-bold text-[#0a2f5b]">{item.topic}</p>

          <div className="space-y-0.5 text-xs text-slate-500">
            <p>{formatWhen(item.scheduled_at)}</p>
            {item.host_name ? <p>প্রশিক্ষক / হোস্ট: {item.host_name}</p> : null}
            {item.support_name ? <p>সহ-হোস্ট: {item.support_name}</p> : null}
            {item.exam_subject_name ? <p>{item.exam_subject_name}</p> : null}
            {item.details?.trim() ? (
              <p className="whitespace-pre-line text-slate-600">{item.details.trim()}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            {!previous ? (
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${permissionClass(item.permission_status, item.access_type)}`}
              >
                {permissionLabel(item.permission_status, item.access_type)}
              </span>
            ) : null}
            {(item.presentation_count ?? 0) > 0 ? (
              <span className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-[11px] font-semibold text-[#1566b8]">
                {bn(item.presentation_count ?? 0)}টি প্রেজেন্টেশন
              </span>
            ) : (item.slide_count ?? 0) > 0 ? (
              <span className="rounded-full bg-[#eaf3fc] px-2.5 py-0.5 text-[11px] font-semibold text-[#1566b8]">
                {bn(item.slide_count ?? 0)}টি স্লাইড
              </span>
            ) : null}
            {(item.recorded_content_count ?? 0) > 0 ? (
              <span className="rounded-full bg-[#e8f8ef] px-2.5 py-0.5 text-[11px] font-semibold text-[#156f4d]">
                {bn(item.recorded_content_count ?? 0)}টি রেকর্ডিং
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <span className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-[#1566b8] px-4 py-2 text-xs font-semibold text-white">
        <PlayCircle className="h-4 w-4" />
        {previous ? 'রেকর্ডিং ও স্লাইড' : isLive ? 'এখনই যোগ দিন' : 'বিস্তারিত দেখুন'}
      </span>
    </Link>
  );
}

export default function LiveStreamUserListPage() {
  const [items, setItems] = useState<LiveRow[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [onlyFree, setOnlyFree] = useState(false);
  const [catalogOrder, setCatalogOrder] = useState<string[]>([]);
  const [canHost, setCanHost] = useState(false);

  useEffect(() => {
    apiFetch<{ data: LiveRow[] }>('/live-streams')
      .then((res) => setItems(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'লাইভ ক্লাস লোড করা যায়নি'))
      .finally(() => setLoading(false));
    apiFetch<{ data: ExamPrepPartsResponse }>('/exam-prep/parts')
      .then((res) => setCatalogOrder(res.data.parts.flatMap((part) => part.subjects.map((subject) => subject.id))))
      .catch(() => setCatalogOrder([]));
    fetchMe()
      .then((me) => {
        const u = me.data;
        setCanHost(
          Boolean(
            u.is_super_admin ||
              u.user_type === 'system_admin' ||
              u.user_type === 'admin' ||
              (u as { can_host_live?: boolean }).can_host_live,
          ),
        );
      })
      .catch(() => setCanHost(false));
  }, []);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (item.exam_subject_id && item.exam_subject_name) {
        map.set(item.exam_subject_id, item.exam_subject_name);
      }
    }
    const rank = (id: string) => {
      const index = catalogOrder.indexOf(id);
      return index < 0 ? Number.MAX_SAFE_INTEGER : index;
    };
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => rank(a.id) - rank(b.id) || a.name.localeCompare(b.name));
  }, [items, catalogOrder]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (onlyFree && i.access_type === 'paid') return false;
      if (subjectFilter !== 'all' && i.exam_subject_id !== subjectFilter) return false;
      return true;
    });
  }, [items, subjectFilter, onlyFree]);

  const { upcoming, previous } = useMemo(() => {
    const up: LiveRow[] = [];
    const prev: LiveRow[] = [];
    for (const item of filtered) {
      if (item.is_previous || item.status === 'ended' || item.status === 'cancelled') prev.push(item);
      else up.push(item);
    }
    return { upcoming: up, previous: prev };
  }, [filtered]);

  const featured = upcoming[0];

  const groupedUpcoming = useMemo(() => {
    const groups = new Map<string, { key: string; title: string; items: LiveRow[] }>();
    for (const item of upcoming) {
      const key = item.exam_subject_id ?? 'none';
      const title = item.exam_subject_name ?? 'সাধারণ ও উন্মুক্ত সেশন';
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

  const freeCount = items.filter((i) => i.access_type !== 'paid' && !i.is_previous && i.status !== 'ended').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a2f5b] sm:text-3xl">লাইভ ক্লাস ও সময়সূচি</h1>
          <p className="mt-1 text-sm text-slate-600">
            সকল লাইভ ক্লাসের পূর্ণাঙ্গ সময়সূচি। ফ্রি ক্লাসগুলো এনরোলমেন্ট ছাড়াই সবার জন্য সরাসরি উন্মুক্ত।
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canHost ? (
            <Link
              href="/live/zoom/hosting"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#1566b8] bg-white px-3.5 py-2 text-xs font-semibold text-[#1566b8] hover:bg-[#eaf3fc]"
            >
              <Radio className="h-3.5 w-3.5" />
              লাইভ হোস্ট প্যানেল
            </Link>
          ) : null}
          <Link
            href="/packages?tab=live"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#1566b8] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#0f5294]"
          >
            লাইভ প্যাকেজ দেখুন
          </Link>
        </div>
      </div>

      {/* Featured Upcoming Hero (PDF Page 14 style) */}
      {featured ? (
        <div className="flex flex-col justify-between gap-4 rounded-2xl bg-[#0a2f5b] p-6 text-white shadow-sm sm:flex-row sm:items-center">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-[#9ed8eb]">
                <CalendarClock className="h-3.5 w-3.5" />
                {featured.status === 'live' ? 'এখন সরাসরি চলছে' : 'পরবর্তী নির্ধারিত ক্লাস'}
              </span>
              {featured.access_type !== 'paid' ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#2aabb8]/30 px-2.5 py-0.5 text-xs font-bold text-[#aef0f7]">
                  <Sparkles className="h-3 w-3" />
                  ফ্রি ক্লাস
                </span>
              ) : null}
            </div>
            <h2 className="text-xl font-bold">{featured.topic}</h2>
            <p className="text-sm text-white/80">
              {formatWhen(featured.scheduled_at)}
              {featured.host_name ? ` · ${featured.host_name}` : ''}
              {featured.exam_subject_name ? ` · ${featured.exam_subject_name}` : ''}
            </p>
          </div>
          <Link
            href={`/live/zoom/${featured.id}`}
            className="inline-flex shrink-0 items-center justify-center rounded-xl bg-[#1566b8] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#1b75d0]"
          >
            ক্লাসে যান
          </Link>
        </div>
      ) : null}

      {/* Filter Bar */}
      {!loading ? (
        <div className="space-y-3 rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOnlyFree(false);
                setSubjectFilter('all');
              }}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                !onlyFree && subjectFilter === 'all'
                  ? 'bg-[#1566b8] text-white'
                  : 'bg-[#f4f9fd] text-[#0a2f5b] hover:bg-[#e5f0fb]'
              }`}
            >
              সব ক্লাস ({bn(items.length)})
            </button>
            <button
              type="button"
              onClick={() => setOnlyFree((v) => !v)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                onlyFree
                  ? 'bg-[#0e7490] text-white'
                  : 'border border-[#9fe0e8] bg-[#e6f6f8] text-[#0e7490] hover:bg-[#d5f0f4]'
              }`}
            >
              ফ্রি ক্লাস ({bn(freeCount)})
            </button>

            {subjectOptions.map((subject) => (
              <button
                key={subject.id}
                type="button"
                onClick={() => setSubjectFilter(subject.id)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  subjectFilter === subject.id
                    ? 'bg-[#0a2f5b] text-white'
                    : 'bg-[#f4f9fd] text-[#0a2f5b] hover:bg-[#e5f0fb]'
                }`}
              >
                {subject.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <Alert variant="error">{error}</Alert> : null}
      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      ) : null}

      {!loading && filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#d7e4ee] bg-white p-8 text-center text-sm text-slate-500">
          এই ফিল্টারে এখনো কোনো লাইভ ক্লাস নির্ধারিত নেই।
        </div>
      ) : null}

      {groupedUpcoming.length > 0 ? (
        <div className="space-y-5">
          <h2 className="text-base font-bold text-[#0a2f5b]">আসন্ন ও চলমান লাইভ ক্লাস</h2>
          {groupedUpcoming.map((group) => (
            <div key={group.key} className="space-y-2.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1566b8]">{group.title}</h3>
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
        <div className="space-y-3 pt-2">
          <h2 className="text-base font-bold text-[#0a2f5b]">পূর্ববর্তী ক্লাস, স্লাইড ও রেকর্ডিং</h2>
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
