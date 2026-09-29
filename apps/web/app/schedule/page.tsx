'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarDays, CalendarCheck, Link2, List, Paperclip, Plus, Receipt, Repeat, Settings2, Sun } from 'lucide-react';
import { addDays, bdTodayStr, type ScheduleEventRecord, type ScheduleOccurrence } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';
import { formatDayLong, formatDayShort, occurrenceTimeText, slotText } from '@/lib/schedule-format';
import { useScheduleTypes } from '@/lib/use-schedule-types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { MonthCalendar, monthRange } from '@/components/schedule/month-calendar';
import { ScheduleEventDetail } from '@/components/schedule/schedule-event-detail';
import {
  ScheduleEventForm,
  emptyScheduleForm,
  recordToScheduleForm,
  type ScheduleFormState,
} from '@/components/schedule/schedule-event-form';
import {
  RestRecreationPanel,
  RestRecreationSummary,
  type RestRecreationData,
} from '@/components/schedule/rest-recreation-panel';

type Tab = 'upcoming' | 'month' | 'rr';
const UPCOMING_DAYS = 90;

function OccurrenceRow({ o, onOpen }: { o: ScheduleOccurrence; onOpen: (o: ScheduleOccurrence) => void }) {
  const { typeLabel, typeColor } = useScheduleTypes();
  const cancelled = o.status === 'cancelled';
  return (
    <button
      type="button"
      onClick={() => onOpen(o)}
      className={cn(
        'flex w-full items-start gap-3 rounded-lg border border-border bg-background p-3 text-left transition-colors hover:bg-slate-50',
        cancelled && 'bg-slate-50/70',
      )}
    >
      <span
        className={cn('mt-1 h-full min-h-[2.25rem] w-1 shrink-0 rounded-full', cancelled && 'opacity-40')}
        style={{ background: typeColor(o.kind) }}
      />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2">
          <span className={cn('font-medium', cancelled && 'text-muted line-through')}>{o.title}</span>
          {cancelled && <Badge variant="destructive">Cancelled</Badge>}
          {o.status === 'postponed' && <Badge variant="warning">Postponed</Badge>}
        </p>
        {o.status === 'postponed' && o.original_date && (
          <p className="text-xs text-amber-800">Was {slotText(o.original_date, o.original_time)}</p>
        )}
        {o.note && o.status !== 'scheduled' && <p className="line-clamp-2 text-xs text-muted">Note: {o.note}</p>}
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
          <span>{occurrenceTimeText(o)}</span>
          <span>· {typeLabel(o.kind)}</span>
          {o.scope === 'universal' ? <span>· Official</span> : <span>· Personal</span>}
          {o.location && <span className="truncate">· {o.location}</span>}
          {o.recurring && <Repeat className="h-3 w-3" aria-label="Repeats" />}
          {o.attachments_count > 0 && (
            <span className="inline-flex items-center gap-0.5">
              <Paperclip className="h-3 w-3" /> {o.attachments_count}
            </span>
          )}
          {o.links_count > 0 && (
            <span className="inline-flex items-center gap-0.5" title="Related process / toolkit">
              <Link2 className="h-3 w-3" /> {o.links_count}
            </span>
          )}
        </p>
      </div>
    </button>
  );
}

function SchedulePageInner() {
  const router = useRouter();
  const params = useSearchParams();
  const { types, typeLabel, typeColor } = useScheduleTypes();
  const today = bdTodayStr();
  const [tab, setTab] = useState<Tab>(() => (params.get('tab') === 'rr' ? 'rr' : params.get('tab') === 'month' ? 'month' : 'upcoming'));
  const [isAdmin, setIsAdmin] = useState(false);
  const [upcoming, setUpcoming] = useState<ScheduleOccurrence[] | null>(null);
  const [monthItems, setMonthItems] = useState<ScheduleOccurrence[]>([]);
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [selectedDay, setSelectedDay] = useState<string | null>(today);
  const [kindFilter, setKindFilter] = useState<string>('');
  const [rr, setRr] = useState<RestRecreationData | null>(null);
  const [error, setError] = useState('');
  const [openEvent, setOpenEvent] = useState<{ id: string; date?: string } | null>(() => {
    const id = params.get('event');
    return id ? { id } : null;
  });
  const [form, setForm] = useState<{ editing: ScheduleEventRecord | null; initial: ScheduleFormState } | null>(null);

  const loadUpcoming = useCallback(async () => {
    try {
      const r = await apiFetch<{ data: ScheduleOccurrence[] }>(`/schedule/feed?from=${today}&to=${addDays(today, UPCOMING_DAYS)}`);
      setUpcoming(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule');
      setUpcoming([]);
    }
  }, [today]);

  const loadMonth = useCallback(async () => {
    const { from, to } = monthRange(ym.y, ym.m);
    try {
      const r = await apiFetch<{ data: ScheduleOccurrence[] }>(`/schedule/feed?from=${from}&to=${to}`);
      setMonthItems(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load month');
    }
  }, [ym]);

  const loadRr = useCallback(async () => {
    try {
      const r = await apiFetch<{ data: RestRecreationData }>('/schedule/rest-recreation');
      setRr(r.data);
    } catch {
      setRr(null);
    }
  }, []);

  useEffect(() => {
    void loadUpcoming();
    void loadRr();
    fetchMe()
      .then((r) => setIsAdmin(isPlatformAdmin(r.data)))
      .catch(() => setIsAdmin(false));
  }, [loadUpcoming, loadRr]);

  useEffect(() => {
    if (tab === 'month') void loadMonth();
  }, [tab, loadMonth]);

  function refreshAll() {
    void loadUpcoming();
    if (tab === 'month') void loadMonth();
  }

  function switchTab(next: Tab) {
    setTab(next);
    const url = new URL(window.location.href);
    if (next === 'upcoming') url.searchParams.delete('tab');
    else url.searchParams.set('tab', next);
    url.searchParams.delete('event');
    window.history.replaceState(null, '', url.toString());
  }

  function openOccurrence(o: ScheduleOccurrence) {
    if (o.source === 'rr') {
      switchTab('rr');
      return;
    }
    setForm(null);
    setOpenEvent({ id: o.event_id, date: o.date });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeDetail() {
    setOpenEvent(null);
    if (params.get('event')) router.replace('/schedule');
  }

  function startEdit(rec: ScheduleEventRecord) {
    if (rec.scope === 'universal') {
      router.push(`/admin/schedule?edit=${rec.id}`);
      return;
    }
    setOpenEvent(null);
    setForm({ editing: rec, initial: recordToScheduleForm(rec) });
  }

  const filtered = useMemo(
    () => (upcoming ?? []).filter((o) => !kindFilter || o.kind === kindFilter),
    [upcoming, kindFilter],
  );
  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleOccurrence[]>();
    for (const o of filtered) map.set(o.date, [...(map.get(o.date) ?? []), o]);
    return [...map.entries()];
  }, [filtered]);

  const todayItems = (upcoming ?? []).filter((o) => o.date === today);
  const nextBill = (upcoming ?? []).find((o) => o.kind === 'bill_submission' && o.status !== 'cancelled');
  const kindsInFeed = types
    .filter((k) => (upcoming ?? []).some((o) => o.kind === k.code))
    .concat(
      [...new Set((upcoming ?? []).map((o) => o.kind))]
        .filter((code) => !types.some((k) => k.code === code))
        .map((code) => ({ ...types[0]!, id: code, code, label: typeLabel(code), color: typeColor(code) })),
    );
  const dayItems = selectedDay ? monthItems.filter((o) => o.date === selectedDay) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule"
        description="Official meetings, bill submission dates, rest & recreation and your own reminders — all in Bangladesh time."
        action={
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/schedule">
                  <Settings2 className="h-4 w-4" /> Manage official
                </Link>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => {
                setOpenEvent(null);
                setForm({ editing: null, initial: emptyScheduleForm('personal', selectedDay && tab === 'month' ? { date: selectedDay } : {}) });
              }}
            >
              <Plus className="h-4 w-4" /> Add personal
            </Button>
          </div>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted">
              <Sun className="h-4 w-4 text-amber-500" /> Today · {formatDayShort(today)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming === null ? (
              <Skeleton className="h-10 w-full" />
            ) : todayItems.length === 0 ? (
              <p className="text-sm text-muted">Nothing scheduled today.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {todayItems.slice(0, 3).map((o, i) => (
                  <li key={`${o.event_id}-${i}`}>
                    <button type="button" className="text-left hover:underline" onClick={() => openOccurrence(o)}>
                      <span className="text-muted">{occurrenceTimeText(o)}</span> · {o.title}
                    </button>
                  </li>
                ))}
                {todayItems.length > 3 && <li className="text-xs text-muted">+{todayItems.length - 3} more</li>}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted">
              <Receipt className="h-4 w-4 text-emerald-600" /> Next bill submission
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcoming === null ? (
              <Skeleton className="h-10 w-full" />
            ) : nextBill ? (
              <button type="button" className="text-left" onClick={() => openOccurrence(nextBill)}>
                <p className="text-lg font-semibold">{formatDayShort(nextBill.date)}</p>
                <p className="text-sm text-muted">{nextBill.title}</p>
              </button>
            ) : (
              <p className="text-sm text-muted">No bill submission date in the next {UPCOMING_DAYS} days.</p>
            )}
          </CardContent>
        </Card>
        <Card className="cursor-pointer transition-colors hover:border-teal-300" onClick={() => switchTab('rr')}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted">
              <CalendarCheck className="h-4 w-4 text-teal-700" /> Rest &amp; recreation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <RestRecreationSummary data={rr} />
          </CardContent>
        </Card>
      </div>

      {form && (
        <ScheduleEventForm
          scope="personal"
          editing={form.editing}
          initial={form.initial}
          title={form.editing ? 'Edit personal schedule' : 'Add personal schedule'}
          onCancel={() => setForm(null)}
          onSaved={(rec) => {
            setForm(null);
            setOpenEvent({ id: rec.id });
            refreshAll();
          }}
        />
      )}

      {openEvent && !form && (
        <ScheduleEventDetail
          eventId={openEvent.id}
          occurrenceDate={openEvent.date}
          onClose={closeDetail}
          onEdit={startEdit}
          onDeleted={() => {
            closeDetail();
            refreshAll();
          }}
          onChanged={refreshAll}
        />
      )}

      <div className="inline-flex rounded-lg border border-border bg-background p-1" role="tablist">
        {(
          [
            { key: 'upcoming', label: 'Upcoming', icon: List },
            { key: 'month', label: 'Month', icon: CalendarDays },
            { key: 'rr', label: 'Rest & recreation', icon: CalendarCheck },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => switchTab(key)}
            className={cn(
              'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors sm:px-4',
              tab === key ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" /> {label}
          </button>
        ))}
      </div>

      {tab === 'upcoming' && (
        <div className="space-y-4">
          {kindsInFeed.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setKindFilter('')}
                className={cn('rounded-full border px-3 py-1 text-xs', !kindFilter ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}
              >
                All
              </button>
              {kindsInFeed.map((k) => (
                <button
                  key={k.code}
                  type="button"
                  onClick={() => setKindFilter(kindFilter === k.code ? '' : k.code)}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs',
                    kindFilter === k.code ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                  )}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: k.color }} /> {k.label}
                </button>
              ))}
            </div>
          )}
          {upcoming === null ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : grouped.length === 0 ? (
            <EmptyState
              title="Nothing coming up"
              description={`No schedules in the next ${UPCOMING_DAYS} days. Add a personal reminder, or check back when the admin posts meetings and deadlines.`}
            />
          ) : (
            grouped.map(([date, list]) => (
              <div key={date} className="space-y-2">
                <p className={cn('text-sm font-semibold', date === today ? 'text-primary' : 'text-foreground')}>
                  {date === today ? 'Today · ' : date === addDays(today, 1) ? 'Tomorrow · ' : ''}
                  {formatDayLong(date)}
                </p>
                {list.map((o, i) => (
                  <OccurrenceRow key={`${o.event_id}-${i}`} o={o} onOpen={openOccurrence} />
                ))}
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'month' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <Card>
            <CardContent className="pt-6">
              <MonthCalendar
                year={ym.y}
                month={ym.m}
                items={monthItems}
                today={today}
                selected={selectedDay}
                onSelect={setSelectedDay}
                onNavigate={(delta) =>
                  setYm((cur) => {
                    const idx = cur.y * 12 + cur.m + delta;
                    return { y: Math.floor(idx / 12), m: idx % 12 };
                  })
                }
              />
            </CardContent>
          </Card>
          <Card className="h-fit">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">{selectedDay ? formatDayLong(selectedDay) : 'Pick a day'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {dayItems.length === 0 ? (
                <p className="text-sm text-muted">Nothing scheduled.</p>
              ) : (
                dayItems.map((o, i) => <OccurrenceRow key={`${o.event_id}-${i}`} o={o} onOpen={openOccurrence} />)
              )}
              {selectedDay && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setOpenEvent(null);
                    setForm({ editing: null, initial: emptyScheduleForm('personal', { date: selectedDay }) });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <Plus className="h-4 w-4" /> Add on this day
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === 'rr' && (
        <RestRecreationPanel
          data={rr}
          onSaved={(d) => {
            setRr(d);
            void loadUpcoming();
          }}
        />
      )}
    </div>
  );
}

export default function SchedulePage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <SchedulePageInner />
    </Suspense>
  );
}
