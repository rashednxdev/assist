'use client';

import { useMemo, useState } from 'react';
import { Ban, CalendarClock, RotateCcw, X } from 'lucide-react';
import { addDays, bdTodayStr, expandOccurrences, type ScheduleEventRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { formatDayShort, slotText } from '@/lib/schedule-format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const textareaClass = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export type ScheduleChangeMode = 'postpone' | 'cancel' | 'restore';

/** Maps a feed date (which may be a postponed slot) back to the original occurrence date. */
export function originalOccurrence(ev: ScheduleEventRecord, date?: string): string | undefined {
  if (!date) return undefined;
  return ev.overrides.find((o) => o.new_date === date)?.date ?? date;
}

/**
 * Postpone, cancel or restore a schedule (whole schedule, or one date of a repeating one) with a
 * note. For published official schedules the recipients are notified with the note.
 */
export function ScheduleChangePanel({
  ev,
  mode: initialMode,
  occurrenceDate,
  onDone,
  onClose,
}: {
  ev: ScheduleEventRecord;
  mode: ScheduleChangeMode;
  occurrenceDate?: string;
  onDone: (rec: ScheduleEventRecord) => void;
  onClose: () => void;
}) {
  const recurring = ev.recurrence.freq !== 'none';
  const today = bdTodayStr();
  const upcoming = useMemo(
    () => (recurring ? expandOccurrences(ev.date, ev.recurrence, addDays(today, -7), addDays(today, 400)).slice(0, 40) : []),
    [ev, recurring, today],
  );
  const changed = ev.overrides.map((o) => o.date);
  const startOcc = originalOccurrence(ev, occurrenceDate) ?? upcoming.find((d) => d >= today) ?? upcoming[0] ?? '';

  const [mode, setMode] = useState<ScheduleChangeMode>(initialMode);
  const [occ, setOcc] = useState(startOcc);
  const [scopeAll, setScopeAll] = useState(!recurring || (initialMode === 'restore' && ev.status === 'cancelled'));
  const override = ev.overrides.find((o) => o.date === occ);
  const current = recurring
    ? { date: override?.new_date ?? occ, time: override?.new_time ?? ev.time }
    : { date: ev.date, time: ev.time };
  const [newDate, setNewDate] = useState(current.date && current.date >= today ? addDays(current.date, 1) : addDays(today, 1));
  const [newTime, setNewTime] = useState(current.time ?? '');
  const [note, setNote] = useState('');
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const notifies = ev.scope === 'universal' && ev.is_published;
  const occChoices = Array.from(new Set([...upcoming, ...changed])).sort();
  const restoreOptions = changed.sort();

  async function submit() {
    setError('');
    if (mode !== 'restore' && !note.trim()) return setError('Add a note so users know why.');
    if (mode === 'postpone' && !newDate) return setError('Choose the new date.');
    if (recurring && mode === 'postpone' && !occ) return setError('Choose which date to postpone.');
    const occurrence_date = recurring && !(mode !== 'postpone' && scopeAll) ? occ || undefined : undefined;
    if (mode === 'restore' && recurring && !scopeAll && !occurrence_date) return setError('Choose which date to restore.');
    const body =
      mode === 'postpone'
        ? { occurrence_date, new_date: newDate, new_time: ev.time ? newTime : '', note: note.trim(), notify }
        : { occurrence_date, note: note.trim() || undefined, notify };
    setSaving(true);
    try {
      const r = await apiFetch<{ data: ScheduleEventRecord }>(`/schedule/events/${ev.id}/${mode}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onDone(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: ScheduleChangeMode; label: string; icon: typeof Ban }> = [
    { id: 'postpone', label: 'Postpone', icon: CalendarClock },
    { id: 'cancel', label: 'Cancel', icon: Ban },
    ...(ev.status === 'cancelled' || ev.overrides.length > 0 ? [{ id: 'restore' as const, label: 'Undo change', icon: RotateCcw }] : []),
  ];

  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setMode(t.id);
                setError('');
                if (t.id === 'restore') setScopeAll(!recurring || ev.status === 'cancelled');
                if (t.id === 'restore' && recurring && ev.status !== 'cancelled' && !changed.includes(occ)) setOcc(restoreOptions[0] ?? '');
              }}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs',
                mode === t.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background',
              )}
            >
              <t.icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {recurring && mode !== 'postpone' && (
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" checked={!scopeAll} onChange={() => setScopeAll(false)} /> One date only
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={scopeAll}
              disabled={mode === 'restore' && ev.status !== 'cancelled'}
              onChange={() => setScopeAll(true)}
            />
            {mode === 'cancel' ? 'The whole schedule (all dates)' : 'The whole schedule'}
          </label>
        </div>
      )}

      {recurring && !(mode !== 'postpone' && scopeAll) && (
        <div className="space-y-1.5">
          <Label htmlFor="c-occ">Which date</Label>
          <select id="c-occ" className={selectClass} value={occ} onChange={(e) => setOcc(e.target.value)}>
            {(mode === 'restore' ? restoreOptions : occChoices).map((d) => {
              const o = ev.overrides.find((x) => x.date === d);
              const tag = o?.cancelled ? ' — cancelled' : o?.new_date ? ` — moved to ${formatDayShort(o.new_date)}` : '';
              return (
                <option key={d} value={d}>
                  {formatDayShort(d)}
                  {d < today ? ' (past)' : ''}
                  {tag}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {mode === 'postpone' && (
        <>
          <p className="text-xs text-muted">Currently: {current.date ? slotText(current.date, current.time) : '—'}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="c-date">New date *</Label>
              <Input id="c-date" type="date" min={today} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
            </div>
            {ev.time && (
              <div className="space-y-1.5">
                <Label htmlFor="c-time">New time</Label>
                <Input id="c-time" type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
              </div>
            )}
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="c-note">
          Note to users {mode === 'restore' ? '(optional)' : '*'}
        </Label>
        <textarea
          id="c-note"
          rows={2}
          className={textareaClass}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          placeholder={
            mode === 'postpone'
              ? 'e.g. Postponed because the Secretary will be on an official tour.'
              : mode === 'cancel'
                ? 'e.g. Cancelled due to the government holiday announced today.'
                : 'e.g. The meeting will go ahead as originally planned.'
          }
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {notifies ? (
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Notify recipients (in-app + push)
          </label>
        ) : (
          <span className="text-xs text-muted">{ev.scope === 'universal' ? 'Draft — nobody is notified.' : 'Only you see this schedule.'}</span>
        )}
        <Button size="sm" disabled={saving} variant={mode === 'cancel' ? 'destructive' : 'default'} onClick={() => void submit()}>
          {saving ? 'Saving…' : mode === 'postpone' ? 'Postpone' : mode === 'cancel' ? 'Cancel schedule' : 'Undo change'}
        </Button>
      </div>
    </div>
  );
}
