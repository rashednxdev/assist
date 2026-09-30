'use client';

import { useEffect, useState } from 'react';
import { FileText, Link2, MessageSquare, Paperclip, Trash2, Upload, X } from 'lucide-react';
import {
  SCHEDULE_REMINDER_OPTIONS,
  WEEKDAY_LABELS,
  bdTodayStr,
  describeRecurrence,
  type ScheduleAttachment,
  type ScheduleEventInput,
  type ScheduleEventRecord,
  type ScheduleKind,
  type ScheduleLinkRecord,
  type ScheduleRecurrence,
  type ScheduleTargetType,
  type OfficeOption,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { getAccessToken } from '@/lib/auth';
import { parseJsonResponse } from '@/lib/parse-json-response';
import { openProtectedFile } from '@/lib/protected-file';
import { useScheduleTypes } from '@/lib/use-schedule-types';
import { cn } from '@/lib/utils';
import { ScheduleLinkPicker } from '@/components/schedule/schedule-link-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { EMPTY_LOCATION, type LocationValue } from '@/components/org/location-selects';
import { ScheduleAudienceField, audienceBody } from '@/components/schedule/schedule-audience-field';

const selectClass = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const textareaClass = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

export interface ScheduleFormState {
  kind: ScheduleKind;
  title: string;
  description: string;
  location: string;
  meeting_link: string;
  date: string;
  all_day: boolean;
  time: string;
  end_time: string;
  multi_day: boolean;
  end_date: string;
  recurrence: ScheduleRecurrence;
  reminders: number[];
  target_type: ScheduleTargetType;
  target_user_ids: string[];
  target_office_type_ids: string[];
  target_offices: OfficeOption[];
  target_location: LocationValue;
  is_published: boolean;
  notify_now: boolean;
  links: ScheduleLinkRecord[];
  change_note: string;
}

export function emptyScheduleForm(scope: 'universal' | 'personal', patch: Partial<ScheduleFormState> = {}): ScheduleFormState {
  return {
    kind: scope === 'personal' ? 'personal' : 'meeting',
    title: '',
    description: '',
    location: '',
    meeting_link: '',
    date: bdTodayStr(),
    all_day: false,
    time: '10:00',
    end_time: '',
    multi_day: false,
    end_date: '',
    recurrence: { freq: 'none', interval: 1, weekdays: [], weekend_shift: 'none' },
    reminders: [1440, 60],
    target_type: 'all',
    target_user_ids: [],
    target_office_type_ids: [],
    target_offices: [],
    target_location: EMPTY_LOCATION,
    is_published: true,
    notify_now: false,
    links: [],
    change_note: '',
    ...patch,
  };
}

export function recordToScheduleForm(r: ScheduleEventRecord): ScheduleFormState {
  return {
    kind: r.kind,
    title: r.title,
    description: r.description ?? '',
    location: r.location ?? '',
    meeting_link: r.meeting_link ?? '',
    date: r.date,
    all_day: !r.time,
    time: r.time ?? '10:00',
    end_time: r.end_time ?? '',
    multi_day: !!r.end_date,
    end_date: r.end_date ?? '',
    recurrence: r.recurrence,
    reminders: r.reminders,
    target_type: r.target_type,
    target_user_ids: r.target_user_ids,
    target_office_type_ids: r.target_office_type_ids ?? [],
    target_offices: (r.target_offices ?? []).map((o) => ({ id: o.id, name: o.name, short_name: o.short_name, parent_path: o.parent_path })),
    target_location: {
      division_id: r.target_location?.division_id ?? '',
      district_id: r.target_location?.district_id ?? '',
      thana_id: r.target_location?.thana_id ?? '',
    },
    is_published: r.is_published,
    notify_now: r.scope === 'universal' && r.is_published,
    links: r.links ?? [],
    change_note: '',
  };
}

async function uploadPdf(eventId: string, file: File): Promise<ScheduleEventRecord> {
  const body = new FormData();
  body.append('pdf', file);
  const token = getAccessToken();
  const res = await fetch(`/api/proxy/v1/schedule/events/${eventId}/attachments`, {
    method: 'POST',
    body,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  const json = await parseJsonResponse<{ data: ScheduleEventRecord; error?: { message?: string } }>(res);
  if (!res.ok) throw new Error(json.error?.message ?? `Upload failed for ${file.name}`);
  return json.data;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function ScheduleEventForm({
  scope,
  editing,
  initial,
  title,
  onSaved,
  onCancel,
}: {
  scope: 'universal' | 'personal';
  editing: ScheduleEventRecord | null;
  initial: ScheduleFormState;
  title?: string;
  onSaved: (rec: ScheduleEventRecord) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState<ScheduleFormState>(initial);
  const [attachments, setAttachments] = useState<ScheduleAttachment[]>(editing?.attachments ?? []);
  const [pending, setPending] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setF(initial);
    setAttachments(editing?.attachments ?? []);
    setPending([]);
    setError('');
  }, [initial, editing]);

  const set = <K extends keyof ScheduleFormState>(key: K, value: ScheduleFormState[K]) => setF((p) => ({ ...p, [key]: value }));
  const setRec = (patch: Partial<ScheduleRecurrence>) => setF((p) => ({ ...p, recurrence: { ...p.recurrence, ...patch } }));
  const { types, typeLabel } = useScheduleTypes();
  const kinds = types.filter(
    (k) => k.code !== 'rest_recreation' && (scope === 'personal' ? k.allow_personal : k.code !== 'personal'),
  );
  const kindOptions =
    f.kind && !kinds.some((k) => k.code === f.kind) ? [...kinds, { code: f.kind, label: `${typeLabel(f.kind)} (inactive)` }] : kinds;

  function changeKind(code: ScheduleKind) {
    const t = types.find((k) => k.code === code);
    setF((p) => ({ ...p, kind: code, ...(!editing && t ? { reminders: [...t.default_reminders] } : {}) }));
  }

  async function removeAttachment(a: ScheduleAttachment) {
    if (!editing || !window.confirm(`Remove "${a.name}"?`)) return;
    try {
      const r = await apiFetch<{ data: ScheduleEventRecord }>(`/schedule/events/${editing.id}/attachments/${a.id}`, { method: 'DELETE' });
      setAttachments(r.data.attachments);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove file');
    }
  }

  async function save() {
    setError('');
    if (!f.title.trim()) return setError('Title is required.');
    if (!f.date) return setError('Date is required.');
    const body: ScheduleEventInput = {
      scope,
      kind: f.kind,
      title: f.title.trim(),
      description: f.description.trim() || undefined,
      location: f.location.trim() || undefined,
      meeting_link: f.meeting_link.trim(),
      date: f.date,
      time: f.all_day ? '' : f.time,
      end_time: f.all_day ? '' : f.end_time,
      end_date: f.multi_day ? f.end_date : '',
      recurrence: { ...f.recurrence, until: f.recurrence.until || undefined },
      reminders: f.reminders,
      ...audienceBody(f),
      is_published: f.is_published,
      notify_now: scope === 'universal' ? f.notify_now : undefined,
      links: scope === 'universal' ? f.links.map((l) => ({ type: l.type, id: l.id })) : [],
      change_note: scope === 'universal' && editing ? f.change_note.trim() : undefined,
    };
    setSaving(true);
    try {
      const r = await apiFetch<{ data: ScheduleEventRecord }>(editing ? `/schedule/events/${editing.id}` : '/schedule/events', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(body),
      });
      let saved = r.data;
      for (const file of pending) saved = await uploadPdf(saved.id, file);
      onSaved(saved);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const monthDay = f.recurrence.month_day ?? Number(f.date.slice(8, 10) || 1);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title ?? (editing ? 'Edit schedule' : 'New schedule')}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" /> Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {error && <Alert variant="error">{error}</Alert>}

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="s-kind">Type</Label>
            <select id="s-kind" className={selectClass} value={f.kind} onChange={(e) => changeKind(e.target.value)}>
              {kindOptions.map((k) => (
                <option key={k.code} value={k.code}>{k.label}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="s-title">Title *</Label>
            <Input id="s-title" value={f.title} onChange={(e) => set('title', e.target.value)} maxLength={160} placeholder="e.g. Monthly coordination meeting" />
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-date">{f.multi_day ? 'Starts' : 'Date'} *</Label>
              <Input id="s-date" type="date" value={f.date} onChange={(e) => set('date', e.target.value)} />
            </div>
            {f.multi_day && (
              <div className="space-y-1.5">
                <Label htmlFor="s-end-date">Ends</Label>
                <Input id="s-end-date" type="date" min={f.date} value={f.end_date} onChange={(e) => set('end_date', e.target.value)} />
              </div>
            )}
            {!f.all_day && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="s-time">Start time</Label>
                  <Input id="s-time" type="time" value={f.time} onChange={(e) => set('time', e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="s-end">End time</Label>
                  <Input id="s-end" type="time" value={f.end_time} onChange={(e) => set('end_time', e.target.value)} />
                </div>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.all_day} onChange={(e) => set('all_day', e.target.checked)} /> All day
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={f.multi_day} onChange={(e) => set('multi_day', e.target.checked)} /> Runs over several days
            </label>
          </div>
          <p className="text-xs text-muted">Times are Bangladesh time.</p>
        </div>

        <div className="space-y-3 rounded-lg border border-border p-3">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="s-freq">Repeat</Label>
              <select
                id="s-freq"
                className={selectClass}
                value={f.recurrence.freq}
                onChange={(e) => setRec({ freq: e.target.value as ScheduleRecurrence['freq'] })}
              >
                <option value="none">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            {f.recurrence.freq !== 'none' && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="s-int">Every</Label>
                  <Input
                    id="s-int"
                    type="number"
                    min={1}
                    max={12}
                    value={f.recurrence.interval}
                    onChange={(e) => setRec({ interval: Math.min(12, Math.max(1, Number(e.target.value) || 1)) })}
                  />
                </div>
                {f.recurrence.freq === 'monthly' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="s-md">On day</Label>
                    <select id="s-md" className={selectClass} value={monthDay} onChange={(e) => setRec({ month_day: Number(e.target.value) })}>
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                      <option value={-1}>Last day of month</option>
                    </select>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="s-until">Until (optional)</Label>
                  <Input id="s-until" type="date" min={f.date} value={f.recurrence.until ?? ''} onChange={(e) => setRec({ until: e.target.value || undefined })} />
                </div>
              </>
            )}
          </div>
          {f.recurrence.freq === 'weekly' && (
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, idx) => {
                const on = f.recurrence.weekdays.includes(idx);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setRec({ weekdays: on ? f.recurrence.weekdays.filter((d) => d !== idx) : [...f.recurrence.weekdays, idx] })}
                    className={cn('rounded-full border px-3 py-1 text-xs', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          )}
          {f.recurrence.freq !== 'none' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="s-shift">If it falls on Friday/Saturday</Label>
                <select
                  id="s-shift"
                  className={selectClass}
                  value={f.recurrence.weekend_shift}
                  onChange={(e) => setRec({ weekend_shift: e.target.value as ScheduleRecurrence['weekend_shift'] })}
                >
                  <option value="none">Keep the date</option>
                  <option value="before">Move to the previous working day</option>
                  <option value="after">Move to the next working day</option>
                </select>
              </div>
              <p className="self-end text-xs text-muted">{describeRecurrence(f.recurrence, f.date)}</p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>Remind me</Label>
          <div className="flex flex-wrap gap-1.5">
            {SCHEDULE_REMINDER_OPTIONS.map((o) => {
              const on = f.reminders.includes(o.minutes);
              return (
                <button
                  key={o.minutes}
                  type="button"
                  disabled={!on && f.reminders.length >= 6}
                  onClick={() => set('reminders', on ? f.reminders.filter((m) => m !== o.minutes) : [...f.reminders, o.minutes])}
                  className={cn('rounded-full border px-3 py-1 text-xs', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted">
            Sent as an in-app notification and mobile push.{f.all_day ? ' All-day items use the daily reminder time set by the admin.' : ''}
            {f.reminders.length === 0 ? ' No reminders selected.' : ''}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="s-loc">Venue / place</Label>
            <Input id="s-loc" value={f.location} onChange={(e) => set('location', e.target.value)} maxLength={300} placeholder="e.g. Conference room, 3rd floor" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-link">Online meeting link</Label>
            <Input id="s-link" value={f.meeting_link} onChange={(e) => set('meeting_link', e.target.value)} placeholder="https://…" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-desc">Details / agenda</Label>
          <textarea id="s-desc" rows={4} className={textareaClass} value={f.description} onChange={(e) => set('description', e.target.value)} maxLength={5000} />
        </div>

        {scope === 'universal' && (
          <>
            <ScheduleAudienceField value={f} onChange={(patch) => setF((p) => ({ ...p, ...patch }))} />

            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Link2 className="h-4 w-4" /> Related process, checklist, template or guide (optional)
              </p>
              <ScheduleLinkPicker value={f.links} onChange={(links) => set('links', links)} />
            </div>

            <div className="space-y-2 rounded-lg border border-border p-3">
              <p className="flex items-center gap-2 text-sm font-medium">
                <Paperclip className="h-4 w-4" /> PDF documents (notice, agenda, order)
              </p>
              {attachments.map((a) => (
                <div key={a.id} className="flex items-center gap-2 rounded-md bg-slate-50 px-2 py-1.5 text-sm">
                  <FileText className="h-4 w-4 shrink-0 text-red-600" />
                  <button
                    type="button"
                    className="min-w-0 flex-1 truncate text-left hover:underline"
                    onClick={() => editing && void openProtectedFile(`/schedule/events/${editing.id}/attachments/${a.id}`).catch((e) => setError(e instanceof Error ? e.message : 'Could not open file'))}
                  >
                    {a.name}
                  </button>
                  <span className="text-xs text-muted">{formatSize(a.size)}</span>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-destructive" onClick={() => void removeAttachment(a)} aria-label="Remove">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {pending.map((file, idx) => (
                <div key={`${file.name}-${idx}`} className="flex items-center gap-2 rounded-md border border-dashed border-border px-2 py-1.5 text-sm">
                  <Upload className="h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1 truncate">{file.name}</span>
                  <span className="text-xs text-muted">{formatSize(file.size)} · uploads on save</span>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => setPending(pending.filter((_, i) => i !== idx))} aria-label="Remove">
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              {attachments.length + pending.length < 10 && (
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-slate-50">
                  <Upload className="h-4 w-4" /> Add PDF
                  <input
                    type="file"
                    accept="application/pdf,.pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files ?? []);
                      const bad = files.find((file) => !file.name.toLowerCase().endsWith('.pdf'));
                      if (bad) setError(`${bad.name} is not a PDF`);
                      setPending((p) => [...p, ...files.filter((file) => file.name.toLowerCase().endsWith('.pdf'))].slice(0, 10 - attachments.length));
                      e.target.value = '';
                    }}
                  />
                </label>
              )}
              <p className="text-xs text-muted">Up to 10 PDFs, 20 MB each. Only signed-in users who receive this schedule can open them.</p>
            </div>

            {editing && (
              <div className="space-y-1.5 rounded-lg border border-primary/30 bg-primary/5 p-3">
                <Label htmlFor="s-note" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Note to users about this change
                </Label>
                <textarea
                  id="s-note"
                  rows={2}
                  className={textareaClass}
                  value={f.change_note}
                  onChange={(e) => set('change_note', e.target.value)}
                  maxLength={1000}
                  placeholder="e.g. Venue changed because the conference room is under repair."
                />
                <p className="text-xs text-muted">
                  Shown on the schedule under “Updates from admin” and included in the notification. To move just one date, use Postpone instead.
                </p>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2 font-medium">
                <input type="checkbox" checked={f.is_published} onChange={(e) => set('is_published', e.target.checked)} /> Published
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={f.notify_now} disabled={!f.is_published} onChange={(e) => set('notify_now', e.target.checked)} />
                {editing ? 'Notify recipients about this change' : 'Announce to recipients now'}
              </label>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Save schedule'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
