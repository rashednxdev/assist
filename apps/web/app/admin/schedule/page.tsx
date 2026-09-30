'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Ban,
  CalendarClock,
  ExternalLink,
  GraduationCap,
  Link2,
  Paperclip,
  Pencil,
  Plus,
  Receipt,
  Repeat,
  Search,
  Timer,
  Trash2,
  TreePalm,
  Users,
} from 'lucide-react';
import { describeRecurrence, type ScheduleEventRecord, type ScheduleSettingsRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { formatDayShort, formatTime12, slotText } from '@/lib/schedule-format';
import { useScheduleTypes } from '@/lib/use-schedule-types';
import { cn } from '@/lib/utils';
import { ScheduleChangePanel, type ScheduleChangeMode } from '@/components/schedule/schedule-change-panel';
import { ScheduleTypesAdmin } from '@/components/schedule/schedule-types-admin';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ScheduleEventForm,
  emptyScheduleForm,
  recordToScheduleForm,
  type ScheduleFormState,
} from '@/components/schedule/schedule-event-form';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

const TEMPLATES: Array<{ key: string; label: string; desc: string; icon: typeof Receipt; form: Partial<ScheduleFormState> }> = [
  {
    key: 'bill',
    label: 'Monthly bill submission',
    desc: 'Salary / pay bill deadline every month',
    icon: Receipt,
    form: {
      kind: 'bill_submission',
      title: 'Monthly salary bill submission',
      all_day: true,
      recurrence: { freq: 'monthly', interval: 1, weekdays: [], month_day: 20, weekend_shift: 'before' },
      reminders: [4320, 1440, 0],
      description: 'Submit the monthly pay bill to the accounts office by this date.',
    },
  },
  {
    key: 'meeting',
    label: 'Meeting',
    desc: 'One-off or recurring official meeting',
    icon: Users,
    form: { kind: 'meeting', title: '', time: '10:00', end_time: '11:00', reminders: [1440, 60] },
  },
  {
    key: 'training',
    label: 'Training / workshop',
    desc: 'Multi-day training with agenda PDF',
    icon: GraduationCap,
    form: { kind: 'training', title: '', time: '09:30', multi_day: true, reminders: [10080, 1440] },
  },
  {
    key: 'deadline',
    label: 'Deadline / return',
    desc: 'Report, statement or return due date',
    icon: Timer,
    form: { kind: 'deadline', title: '', all_day: true, reminders: [10080, 1440, 0] },
  },
  {
    key: 'holiday',
    label: 'Holiday / closure',
    desc: 'Govt. holiday or office closure',
    icon: TreePalm,
    form: { kind: 'holiday', title: '', all_day: true, reminders: [1440] },
  },
];

function SettingsCard() {
  const [s, setS] = useState<ScheduleSettingsRecord | null>(null);
  const [daysText, setDaysText] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: ScheduleSettingsRecord }>('/schedule/settings')
      .then((r) => {
        setS(r.data);
        setDaysText(r.data.rr_reminder_days.join(', '));
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings'));
  }, []);

  async function save() {
    if (!s) return;
    setError('');
    setMsg('');
    const days = daysText.split(/[,\s]+/).filter(Boolean).map(Number);
    if (days.some((d) => !Number.isInteger(d) || d < 0 || d > 365)) return setError('Reminder days must be whole numbers from 0 to 365.');
    setSaving(true);
    try {
      const r = await apiFetch<{ data: ScheduleSettingsRecord }>('/schedule/settings', {
        method: 'PUT',
        body: JSON.stringify({ ...s, rr_reminder_days: days }),
      });
      setS(r.data);
      setDaysText(r.data.rr_reminder_days.join(', '));
      setMsg('Saved');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle className="text-base">Rest &amp; recreation rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && <Alert variant="error">{error}</Alert>}
        {msg && <Alert variant="success">{msg}</Alert>}
        {!s ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="st-cycle">Every (years)</Label>
                <Input id="st-cycle" type="number" min={1} max={10} value={s.rr_cycle_years} onChange={(e) => setS({ ...s, rr_cycle_years: Number(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-days">Leave days</Label>
                <Input id="st-days" type="number" min={1} max={60} value={s.rr_days} onChange={(e) => setS({ ...s, rr_days: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-from">After a leave, the next cycle counts from</Label>
              <select
                id="st-from"
                className={selectClass}
                value={s.rr_count_from}
                onChange={(e) => setS({ ...s, rr_count_from: e.target.value as ScheduleSettingsRecord['rr_count_from'] })}
              >
                <option value="leave_end">The day after the leave ended</option>
                <option value="leave_start">The first day of the leave</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-rem">Remind users (days before due)</Label>
              <Input id="st-rem" value={daysText} onChange={(e) => setDaysText(e.target.value)} placeholder="30, 7, 0" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st-time">Daily reminder time (R&amp;R and all-day items)</Label>
              <Input id="st-time" type="time" value={s.reminder_time} onChange={(e) => setS({ ...s, reminder_time: e.target.value })} />
            </div>
            <Button disabled={saving} onClick={() => void save()}>
              {saving ? 'Saving…' : 'Save rules'}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

type AdminTab = 'schedules' | 'types' | 'rules';

function ScheduleAdminInner() {
  const params = useSearchParams();
  const { typeLabel, typeColor } = useScheduleTypes();
  const [tab, setTab] = useState<AdminTab>(() =>
    params.get('tab') === 'types' ? 'types' : params.get('tab') === 'rules' ? 'rules' : 'schedules',
  );
  const [changing, setChanging] = useState<{ ev: ScheduleEventRecord; mode: ScheduleChangeMode } | null>(null);
  const [items, setItems] = useState<ScheduleEventRecord[] | null>(null);
  const [q, setQ] = useState('');
  const [includePast, setIncludePast] = useState(false);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [form, setForm] = useState<{ editing: ScheduleEventRecord | null; initial: ScheduleFormState } | null>(null);

  const load = useCallback(
    async (term = '') => {
      try {
        const qs = new URLSearchParams();
        if (term.trim()) qs.set('q', term.trim());
        if (includePast) qs.set('include_past', 'true');
        const r = await apiFetch<{ data: ScheduleEventRecord[] }>(`/schedule/admin/events?${qs}`);
        setItems(r.data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load schedules');
        setItems([]);
      }
    },
    [includePast],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const startEdit = useCallback(async (id: string) => {
    setError('');
    try {
      const r = await apiFetch<{ data: ScheduleEventRecord }>(`/schedule/events/${id}`);
      setForm({ editing: r.data, initial: recordToScheduleForm(r.data) });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule');
    }
  }, []);

  useEffect(() => {
    const id = params.get('edit');
    if (id) {
      setTab('schedules');
      void startEdit(id);
    }
  }, [params, startEdit]);

  async function remove(ev: ScheduleEventRecord) {
    if (!window.confirm(`Delete "${ev.title}"${ev.recurrence.freq !== 'none' ? ' and all its repeats' : ''}? Users will stop getting reminders.`)) return;
    try {
      await apiFetch(`/schedule/events/${ev.id}`, { method: 'DELETE' });
      if (form?.editing?.id === ev.id) setForm(null);
      await load(q);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Schedule admin"
        description="Post official schedules for everyone or selected users: meetings, monthly bill submission dates, trainings, deadlines and holidays. Users get in-app and mobile reminders at the times you choose."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/schedule">
              <CalendarClock className="h-4 w-4" /> View as user
            </Link>
          </Button>
        }
      />

      <div className="inline-flex rounded-lg border border-border bg-background p-1" role="tablist">
        {(
          [
            { key: 'schedules', label: 'Schedules' },
            { key: 'types', label: 'Types' },
            { key: 'rules', label: 'R&R rules' },
          ] as const
        ).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => {
              setTab(key);
              const url = new URL(window.location.href);
              if (key === 'schedules') url.searchParams.delete('tab');
              else url.searchParams.set('tab', key);
              url.searchParams.delete('edit');
              window.history.replaceState(null, '', url.toString());
            }}
            className={cn(
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              tab === key ? 'bg-primary text-primary-foreground' : 'text-muted hover:text-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'types' && <ScheduleTypesAdmin />}
      {tab === 'rules' && (
        <div className="max-w-md">
          <SettingsCard />
        </div>
      )}

      {tab === 'schedules' && (
        <>
      {error && <Alert variant="error">{error}</Alert>}
      {msg && <Alert variant="success">{msg}</Alert>}

      {!form && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setMsg('');
                setForm({ editing: null, initial: emptyScheduleForm('universal', t.form) });
              }}
              className="flex flex-col items-start gap-1 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <t.icon className="h-5 w-5 text-primary" />
              <span className="font-medium">{t.label}</span>
              <span className="text-xs text-muted">{t.desc}</span>
            </button>
          ))}
        </div>
      )}

      {form && (
        <ScheduleEventForm
          scope="universal"
          editing={form.editing}
          initial={form.initial}
          title={form.editing ? 'Edit official schedule' : 'New official schedule'}
          onCancel={() => setForm(null)}
          onSaved={(rec) => {
            setForm(null);
            setMsg(`Saved “${rec.title}”.`);
            void load(q);
          }}
        />
      )}

        <Card>
          <CardHeader className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="text-base">
                Official schedules <span className="font-normal text-muted">({items?.length ?? 0})</span>
              </CardTitle>
              <Button size="sm" onClick={() => setForm({ editing: null, initial: emptyScheduleForm('universal') })}>
                <Plus className="h-4 w-4" /> New
              </Button>
            </div>
            <form
              className="flex flex-wrap gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void load(q);
              }}
            >
              <div className="relative min-w-[12rem] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, venue…" className="pl-9" />
              </div>
              <Button type="submit" variant="outline">Search</Button>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={includePast} onChange={(e) => setIncludePast(e.target.checked)} /> Include past
              </label>
            </form>
          </CardHeader>
          <CardContent>
            {items === null ? (
              <Skeleton className="h-24 w-full" />
            ) : items.length === 0 ? (
              <p className="text-sm text-muted">No official schedules yet. Start with a template above.</p>
            ) : (
              <div className="space-y-2">
                {items.map((ev) => (
                  <div key={ev.id} className="space-y-2 rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-start gap-3">
                    <span className={cn('mt-1 h-10 w-1 shrink-0 rounded-full', ev.status === 'cancelled' && 'opacity-40')} style={{ background: typeColor(ev.kind) }} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                        <span className="font-medium text-foreground">{formatDayShort(ev.date)}</span>
                        <span>{ev.time ? formatTime12(ev.time) : 'All day'}</span>
                        <Badge variant="outline">{typeLabel(ev.kind)}</Badge>
                        {!ev.is_published && <Badge variant="warning">Draft</Badge>}
                        {ev.status === 'cancelled' && <Badge variant="destructive">Cancelled</Badge>}
                        {ev.postponed_from && ev.status !== 'cancelled' && (
                          <Badge variant="warning">Postponed from {slotText(ev.postponed_from.date, ev.postponed_from.time)}</Badge>
                        )}
                        {ev.overrides.length > 0 && (
                          <Badge variant="warning">
                            {ev.overrides.length} date{ev.overrides.length > 1 ? 's' : ''} changed
                          </Badge>
                        )}
                        {ev.recurrence.freq !== 'none' && (
                          <span className="inline-flex items-center gap-1">
                            <Repeat className="h-3 w-3" /> {describeRecurrence(ev.recurrence, ev.date)}
                          </span>
                        )}
                      </div>
                      <p className={cn('mt-0.5 font-medium', ev.status === 'cancelled' && 'text-muted line-through')}>{ev.title}</p>
                      <p className="flex flex-wrap gap-3 text-xs text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3 w-3" /> {ev.target_label}
                        </span>
                        {ev.attachments.length > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Paperclip className="h-3 w-3" /> {ev.attachments.length} PDF
                          </span>
                        )}
                        {ev.links.length > 0 && (
                          <span className="inline-flex items-center gap-1" title={ev.links.map((l) => l.title).join(', ')}>
                            <Link2 className="h-3 w-3" /> {ev.links.length} linked
                          </span>
                        )}
                        {ev.location && <span>{ev.location}</span>}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setChanging(changing?.ev.id === ev.id ? null : { ev, mode: 'postpone' })}>
                        <CalendarClock className="h-4 w-4" /> Postpone
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setChanging(changing?.ev.id === ev.id ? null : { ev, mode: ev.status === 'cancelled' ? 'restore' : 'cancel' })
                        }
                      >
                        <Ban className="h-4 w-4" /> {ev.status === 'cancelled' ? 'Restore' : 'Cancel'}
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/schedule?event=${ev.id}`} target="_blank" aria-label="Open">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void startEdit(ev.id)}>
                        <Pencil className="h-4 w-4" /> Edit
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void remove(ev)} aria-label="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {changing?.ev.id === ev.id && (
                    <ScheduleChangePanel
                      ev={changing.ev}
                      mode={changing.mode}
                      onClose={() => setChanging(null)}
                      onDone={(rec) => {
                        setChanging(null);
                        setMsg(`Updated “${rec.title}”.`);
                        void load(q);
                      }}
                    />
                  )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </>
      )}
    </div>
  );
}

export default function ScheduleAdminPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 w-full" />}>
      <ScheduleAdminInner />
    </Suspense>
  );
}
