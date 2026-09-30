'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Ban,
  Bell,
  CalendarClock,
  ChevronRight,
  ExternalLink,
  FileText,
  Link2,
  MapPin,
  MessageSquare,
  Pencil,
  Repeat,
  RotateCcw,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { describeRecurrence, type ScheduleChangeLogEntry, type ScheduleEventRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { openProtectedFile } from '@/lib/protected-file';
import { formatDayLong, formatDayShort, formatTime12, reminderLabel, slotText } from '@/lib/schedule-format';
import { useScheduleTypes } from '@/lib/use-schedule-types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { ScheduleChangePanel, originalOccurrence, type ScheduleChangeMode } from '@/components/schedule/schedule-change-panel';

const ACTION_LABEL: Record<ScheduleChangeLogEntry['action'], string> = {
  updated: 'Updated',
  postponed: 'Postponed',
  cancelled: 'Cancelled',
  restored: 'Back on schedule',
};

function changeSummary(c: ScheduleChangeLogEntry): string {
  const parts: string[] = [];
  if (c.occurrence_date) parts.push(`Date ${formatDayShort(c.occurrence_date)}`);
  if (c.action === 'postponed' && c.from && c.to) parts.push(`${slotText(c.from.date, c.from.time)} → ${slotText(c.to.date, c.to.time)}`);
  else if (c.action === 'updated' && c.from && c.to) parts.push(`Moved ${slotText(c.from.date, c.from.time)} → ${slotText(c.to.date, c.to.time)}`);
  else if (c.action === 'cancelled' && !c.occurrence_date && c.from) parts.push('Whole schedule');
  return parts.join(' · ');
}

function formatAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka' });
}

export function ScheduleEventDetail({
  eventId,
  occurrenceDate,
  onClose,
  onEdit,
  onDeleted,
  onChanged,
}: {
  eventId: string;
  occurrenceDate?: string;
  onClose: () => void;
  onEdit: (rec: ScheduleEventRecord) => void;
  onDeleted: () => void;
  /** Called after a postpone/cancel/restore so lists can reload. */
  onChanged?: (rec: ScheduleEventRecord) => void;
}) {
  const { typeLabel, typeColor } = useScheduleTypes();
  const [ev, setEv] = useState<ScheduleEventRecord | null>(null);
  const [error, setError] = useState('');
  const [changeMode, setChangeMode] = useState<ScheduleChangeMode | null>(null);

  useEffect(() => {
    setEv(null);
    setError('');
    setChangeMode(null);
    apiFetch<{ data: ScheduleEventRecord }>(`/schedule/events/${eventId}`)
      .then((r) => setEv(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load schedule'));
  }, [eventId]);

  async function remove() {
    if (!ev || !window.confirm(`Delete "${ev.title}"${ev.recurrence.freq !== 'none' ? ' and all its repeats' : ''}?`)) return;
    try {
      await apiFetch(`/schedule/events/${ev.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  const recurring = ev ? ev.recurrence.freq !== 'none' : false;
  const origDate = ev ? originalOccurrence(ev, occurrenceDate) : undefined;
  const override = ev && origDate ? ev.overrides.find((o) => o.date === origDate) : undefined;
  const date = override?.new_date ?? occurrenceDate ?? ev?.date;
  const time = override?.new_time ?? ev?.time;
  const cancelled = ev ? ev.status === 'cancelled' || !!override?.cancelled : false;
  const moved = ev
    ? override?.new_date
      ? { date: override.date, time: ev.time }
      : !recurring && ev.postponed_from
        ? ev.postponed_from
        : undefined
    : undefined;
  const bannerNote = ev ? (ev.status === 'cancelled' ? ev.cancel_note : override?.note) : undefined;
  const postponeNote = !override && moved ? ev?.change_log.find((c) => c.action === 'postponed' && !c.occurrence_date)?.note : undefined;

  return (
    <Card className="border-primary/30">
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
        {ev ? (
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: typeColor(ev.kind) }} />
              <span className="text-xs font-medium text-muted">{typeLabel(ev.kind)}</span>
              <Badge variant={ev.scope === 'universal' ? 'secondary' : 'outline'}>{ev.scope === 'universal' ? 'Official' : 'Personal'}</Badge>
              {!ev.is_published && <Badge variant="warning">Draft</Badge>}
              {cancelled ? <Badge variant="destructive">Cancelled</Badge> : moved ? <Badge variant="warning">Postponed</Badge> : null}
            </div>
            <CardTitle className={cancelled ? 'text-lg text-muted line-through' : 'text-lg'}>{ev.title}</CardTitle>
          </div>
        ) : (
          <Skeleton className="h-6 w-48" />
        )}
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        {!ev && !error && <Skeleton className="h-24 w-full" />}
        {ev && date && (
          <>
            {cancelled && (
              <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <p className="flex items-center gap-2 font-medium">
                  <Ban className="h-4 w-4" />
                  {ev.status === 'cancelled' ? 'This schedule has been cancelled' : `Cancelled for ${formatDayShort(origDate ?? date)}`}
                </p>
                {bannerNote && <p className="mt-1 whitespace-pre-line">Note from admin: {bannerNote}</p>}
              </div>
            )}
            {!cancelled && moved && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="flex items-center gap-2 font-medium">
                  <CalendarClock className="h-4 w-4" /> Postponed — was {slotText(moved.date, moved.time)}
                </p>
                {(override?.note || postponeNote) && <p className="mt-1 whitespace-pre-line">Note from admin: {override?.note || postponeNote}</p>}
              </div>
            )}

            <div className="space-y-2 text-sm">
              <p className="flex items-start gap-2">
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <span>
                  {formatDayLong(date)}
                  {ev.end_date && !recurring ? ` – ${formatDayLong(ev.end_date)}` : ''}
                  <span className="block text-muted">
                    {time ? `${formatTime12(time)}${ev.end_time && !override?.new_time ? ` – ${formatTime12(ev.end_time)}` : ''}` : 'All day'}
                  </span>
                </span>
              </p>
              {recurring && (
                <p className="flex items-start gap-2">
                  <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {describeRecurrence(ev.recurrence, ev.date)}
                </p>
              )}
              {ev.location && (
                <p className="flex items-start gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {ev.location}
                </p>
              )}
              {ev.reminders.length > 0 && (
                <p className="flex items-start gap-2">
                  <Bell className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {ev.reminders.map(reminderLabel).join(', ')}
                </p>
              )}
              {ev.scope === 'universal' && ev.can_edit && (
                <p className="flex items-start gap-2">
                  <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  {ev.target_label}
                </p>
              )}
            </div>

            {ev.meeting_link && !cancelled && (
              <Button asChild size="sm">
                <a href={ev.meeting_link} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4" /> Join online
                </a>
              </Button>
            )}

            {ev.description && <p className="whitespace-pre-line rounded-md bg-slate-50 p-3 text-sm leading-relaxed">{ev.description}</p>}

            {ev.links.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  <Link2 className="h-3.5 w-3.5" /> How to do it
                </p>
                {ev.links.map((l) => (
                  <Link
                    key={`${l.type}:${l.id}`}
                    href={l.href}
                    className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-slate-50"
                  >
                    <Badge variant="secondary">{l.subtitle}</Badge>
                    <span className="min-w-0 flex-1 truncate font-medium">{l.title}</span>
                    {!l.is_published && <Badge variant="warning">Draft</Badge>}
                    <ChevronRight className="h-4 w-4 text-muted" />
                  </Link>
                ))}
              </div>
            )}

            {ev.attachments.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Documents</p>
                {ev.attachments.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm hover:bg-slate-50"
                    onClick={() =>
                      void openProtectedFile(`/schedule/events/${ev.id}/attachments/${a.id}`).catch((e) =>
                        setError(e instanceof Error ? e.message : 'Could not open file'),
                      )
                    }
                  >
                    <FileText className="h-4 w-4 shrink-0 text-red-600" />
                    <span className="min-w-0 flex-1 truncate">{a.name}</span>
                    <ExternalLink className="h-3.5 w-3.5 text-muted" />
                  </button>
                ))}
              </div>
            )}

            {ev.change_log.length > 0 && (
              <div className="space-y-1.5">
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted">
                  <MessageSquare className="h-3.5 w-3.5" /> Updates from admin
                </p>
                <ol className="space-y-2 border-l-2 border-border pl-3">
                  {ev.change_log.slice(0, 10).map((c, i) => (
                    <li key={`${c.at}-${i}`} className="text-sm">
                      <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                        <span className="font-semibold text-foreground">{ACTION_LABEL[c.action]}</span>
                        <span>{formatAt(c.at)}</span>
                      </p>
                      {changeSummary(c) && <p className="text-xs text-muted">{changeSummary(c)}</p>}
                      {c.note && <p className="mt-0.5 whitespace-pre-line">{c.note}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {ev.can_edit && changeMode && (
              <ScheduleChangePanel
                ev={ev}
                mode={changeMode}
                occurrenceDate={occurrenceDate}
                onClose={() => setChangeMode(null)}
                onDone={(rec) => {
                  setEv(rec);
                  setChangeMode(null);
                  onChanged?.(rec);
                }}
              />
            )}

            {ev.can_edit && !changeMode && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                <Button size="sm" variant="outline" onClick={() => onEdit(ev)}>
                  <Pencil className="h-4 w-4" /> Edit
                </Button>
                <Button size="sm" variant="outline" onClick={() => setChangeMode('postpone')}>
                  <CalendarClock className="h-4 w-4" /> Postpone
                </Button>
                {cancelled || ev.overrides.length > 0 ? (
                  <Button size="sm" variant="outline" onClick={() => setChangeMode('restore')}>
                    <RotateCcw className="h-4 w-4" /> Undo change
                  </Button>
                ) : null}
                {ev.status !== 'cancelled' && (
                  <Button size="sm" variant="outline" onClick={() => setChangeMode('cancel')}>
                    <Ban className="h-4 w-4" /> Cancel
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => void remove()}>
                  <Trash2 className="h-4 w-4" /> Delete
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
