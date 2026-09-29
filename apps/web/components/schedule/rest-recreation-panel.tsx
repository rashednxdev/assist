'use client';

import { useEffect, useState } from 'react';
import { CalendarCheck, Plus, Trash2 } from 'lucide-react';
import type { RestRecreationStatus, ScheduleProfileRecord, ScheduleSettingsRecord } from '@ibas/shared-types';
import { addYears, bdTodayStr, daysBetween } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { formatDayLong, formatDayShort } from '@/lib/schedule-format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

export interface RestRecreationData {
  profile: ScheduleProfileRecord;
  settings: ScheduleSettingsRecord;
  status: RestRecreationStatus;
}

type HistoryRow = { start_date: string; end_date: string; note: string };

export function RestRecreationSummary({ data }: { data: RestRecreationData | null }) {
  if (!data) return <Skeleton className="h-24 w-full" />;
  const s = data.status;
  if (!s.due_date || s.days_left === undefined) {
    return <p className="text-sm text-muted">Add your joining date to see when rest &amp; recreation leave is due.</p>;
  }
  const total = daysBetween(s.basis_date!, s.due_date);
  const pct = Math.min(100, Math.max(0, ((total - Math.max(0, s.days_left)) / Math.max(1, total)) * 100));
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-2xl font-semibold">
          {s.eligible ? 'Due now' : `${s.days_left} day${s.days_left === 1 ? '' : 's'}`}
          {!s.eligible && <span className="ml-1 text-sm font-normal text-muted">left</span>}
        </p>
        {s.eligible ? <Badge variant="success">Eligible since {formatDayShort(s.due_date)}</Badge> : <Badge variant="outline">Due {formatDayShort(s.due_date)}</Badge>}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div className={s.eligible ? 'h-full bg-emerald-500' : 'h-full bg-teal-600'} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-muted">
        {s.leave_days} days every {s.cycle_years} years · counted from {s.basis === 'joining' ? 'joining date' : 'last R&R leave'} (
        {formatDayShort(s.basis_date!)})
      </p>
    </div>
  );
}

export function RestRecreationPanel({ data, onSaved }: { data: RestRecreationData | null; onSaved: (d: RestRecreationData) => void }) {
  const [joining, setJoining] = useState('');
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [reminders, setReminders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setJoining(data.profile.joining_date ?? '');
    setRows(data.profile.rr_history.map((h) => ({ start_date: h.start_date, end_date: h.end_date ?? '', note: h.note ?? '' })));
    setReminders(data.profile.rr_reminders);
  }, [data]);

  async function save() {
    setError('');
    setSaved(false);
    setSaving(true);
    try {
      const r = await apiFetch<{ data: RestRecreationData }>('/schedule/profile', {
        method: 'PUT',
        body: JSON.stringify({
          joining_date: joining,
          rr_history: rows.filter((h) => h.start_date).map((h) => ({ start_date: h.start_date, end_date: h.end_date, note: h.note.trim() || undefined })),
          rr_reminders: reminders,
        }),
      });
      onSaved(r.data);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!data) return <Skeleton className="h-64 w-full" />;
  const s = data.status;
  const today = bdTodayStr();
  const setRow = (idx: number, patch: Partial<HistoryRow>) => setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">My service dates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {error && <Alert variant="error">{error}</Alert>}
          {saved && <Alert variant="success">Saved. Your reminders are updated.</Alert>}
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="rr-join">Date of joining government service</Label>
            <Input id="rr-join" type="date" max={today} value={joining} onChange={(e) => setJoining(e.target.value)} />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">Rest &amp; recreation leave already taken</p>
            <p className="text-xs text-muted">Add each R&amp;R leave you have enjoyed. The next cycle counts from the most recent one.</p>
            {rows.map((r, idx) => (
              <div key={idx} className="grid items-end gap-2 rounded-md border border-border p-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
                <div className="space-y-1">
                  <Label className="text-xs">From</Label>
                  <Input type="date" max={today} value={r.start_date} onChange={(e) => setRow(idx, { start_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">To</Label>
                  <Input type="date" min={r.start_date} value={r.end_date} onChange={(e) => setRow(idx, { end_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Note (order no.)</Label>
                  <Input value={r.note} maxLength={200} onChange={(e) => setRow(idx, { note: e.target.value })} />
                </div>
                <Button type="button" variant="ghost" size="sm" className="text-destructive" onClick={() => setRows(rows.filter((_, i) => i !== idx))} aria-label="Remove">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" disabled={rows.length >= 30} onClick={() => setRows([...rows, { start_date: '', end_date: '', note: '' }])}>
              <Plus className="h-4 w-4" /> Add leave
            </Button>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={reminders} onChange={(e) => setReminders(e.target.checked)} />
            Remind me {data.settings.rr_reminder_days.map((d) => (d === 0 ? 'on the day' : `${d} days before`)).join(', ')}
          </label>

          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4 text-teal-700" /> Next rest &amp; recreation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RestRecreationSummary data={data} />
            {s.due_date && (
              <div className="space-y-1 rounded-md bg-slate-50 p-3 text-xs text-muted">
                <p>
                  Eligible from <span className="font-medium text-foreground">{formatDayLong(s.due_date)}</span>
                </p>
                <p>The cycle after that would be due around {formatDayShort(addYears(s.due_date, s.cycle_years))} if taken on time.</p>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-2 pt-6 text-xs text-muted">
            <p className="font-medium text-foreground">How it is calculated</p>
            <p>
              {data.settings.rr_days} days of rest &amp; recreation leave (শ্রান্তি ও বিনোদন ছুটি) become due every {data.settings.rr_cycle_years}{' '}
              years — first from the joining date, then from the{' '}
              {data.settings.rr_count_from === 'leave_end' ? 'day after your last R&R leave ended' : 'first day of your last R&R leave'}.
            </p>
            <p>These rules are set by the admin. Check the current government order before applying.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
