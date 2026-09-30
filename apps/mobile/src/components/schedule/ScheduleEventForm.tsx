import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  SCHEDULE_REMINDER_OPTIONS,
  WEEKDAY_LABELS,
  bdTodayStr,
  describeRecurrence,
  type ScheduleEventInput,
  type ScheduleEventRecord,
  type ScheduleRecurrence,
} from '@ibas/shared-types';
import { FormScroll } from '@/components/ui/FormScroll';
import { TextField } from '@/components/ui/TextField';
import { DateField } from '@/components/ui/DateField';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { Button } from '@/components/ui/Button';
import { PickerSheet, SelectField, type PickerOption } from '@/components/ui/PickerSheet';
import { TimeField } from '@/components/schedule/TimeField';
import { Card, Chip, ErrorBox, SectionLabel } from '@/components/schedule/ScheduleBits';
import { saveScheduleEvent, useScheduleTypes } from '@/lib/schedule-api';
import { colors, spacing } from '@/theme';

interface FormState {
  kind: string;
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
}

function initialState(editing: ScheduleEventRecord | null, date?: string): FormState {
  if (editing) {
    return {
      kind: editing.kind,
      title: editing.title,
      description: editing.description ?? '',
      location: editing.location ?? '',
      meeting_link: editing.meeting_link ?? '',
      date: editing.date,
      all_day: !editing.time,
      time: editing.time ?? '10:00',
      end_time: editing.end_time ?? '',
      multi_day: !!editing.end_date,
      end_date: editing.end_date ?? '',
      recurrence: editing.recurrence,
      reminders: editing.reminders,
    };
  }
  return {
    kind: 'personal',
    title: '',
    description: '',
    location: '',
    meeting_link: '',
    date: date || bdTodayStr(),
    all_day: false,
    time: '10:00',
    end_time: '',
    multi_day: false,
    end_date: '',
    recurrence: { freq: 'none', interval: 1, weekdays: [], weekend_shift: 'none' },
    reminders: [1440, 60],
  };
}

const FREQ_OPTIONS: PickerOption[] = [
  { value: 'none', label: 'Does not repeat' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const SHIFT_OPTIONS: PickerOption[] = [
  { value: 'none', label: 'Keep the date' },
  { value: 'before', label: 'Move to the previous working day' },
  { value: 'after', label: 'Move to the next working day' },
];

const INTERVAL_OPTIONS: PickerOption[] = Array.from({ length: 12 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

const MONTH_DAY_OPTIONS: PickerOption[] = [
  ...Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Day ${i + 1}` })),
  { value: '-1', label: 'Last day of month' },
];

type Picker = 'kind' | 'freq' | 'interval' | 'month_day' | 'shift' | null;

/** Add / edit a personal schedule. Official schedules are managed by admins on the website. */
export function ScheduleEventForm({
  editing,
  initialDate,
  onSaved,
}: {
  editing: ScheduleEventRecord | null;
  initialDate?: string;
  onSaved: (rec: ScheduleEventRecord) => void;
}) {
  const { types, typeLabel } = useScheduleTypes();
  const [f, setF] = useState<FormState>(() => initialState(editing, initialDate));
  const [picker, setPicker] = useState<Picker>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((p) => ({ ...p, [key]: value }));
  const setRec = (patch: Partial<ScheduleRecurrence>) => setF((p) => ({ ...p, recurrence: { ...p.recurrence, ...patch } }));

  const kinds = types.filter((k) => k.code !== 'rest_recreation' && k.allow_personal);
  const kindOptions: PickerOption[] = [
    ...kinds.map((k) => ({ value: k.code, label: k.label })),
    ...(f.kind && !kinds.some((k) => k.code === f.kind) ? [{ value: f.kind, label: `${typeLabel(f.kind)} (inactive)` }] : []),
  ];
  const monthDay = f.recurrence.month_day ?? Number(f.date.slice(8, 10) || 1);
  const repeating = f.recurrence.freq !== 'none';

  function changeKind(code: string) {
    const t = types.find((k) => k.code === code);
    setF((p) => ({ ...p, kind: code, ...(!editing && t ? { reminders: [...t.default_reminders] } : {}) }));
  }

  async function save() {
    setError('');
    if (!f.title.trim()) return setError('Title is required.');
    if (!f.date) return setError('Date is required.');
    if (f.multi_day && f.end_date && f.end_date < f.date) return setError('End date is before the start date.');
    if (f.recurrence.until && f.recurrence.until < f.date) return setError('Repeat-until is before the start date.');
    const body: ScheduleEventInput = {
      scope: 'personal',
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
      links: [],
    };
    setSaving(true);
    try {
      onSaved(await saveScheduleEvent(body, editing?.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const pickerProps: Record<Exclude<Picker, null>, { title: string; options: PickerOption[]; value: string; onSelect: (v: string) => void }> = {
    kind: { title: 'Type', options: kindOptions, value: f.kind, onSelect: changeKind },
    freq: { title: 'Repeat', options: FREQ_OPTIONS, value: f.recurrence.freq, onSelect: (v) => setRec({ freq: v as ScheduleRecurrence['freq'] }) },
    interval: { title: 'Every', options: INTERVAL_OPTIONS, value: String(f.recurrence.interval), onSelect: (v) => setRec({ interval: Number(v) }) },
    month_day: { title: 'On day', options: MONTH_DAY_OPTIONS, value: String(monthDay), onSelect: (v) => setRec({ month_day: Number(v) }) },
    shift: {
      title: 'If it falls on Friday/Saturday',
      options: SHIFT_OPTIONS,
      value: f.recurrence.weekend_shift,
      onSelect: (v) => setRec({ weekend_shift: v as ScheduleRecurrence['weekend_shift'] }),
    },
  };
  const active = picker ? pickerProps[picker] : null;
  const unit = { none: '', daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' }[f.recurrence.freq];

  return (
    <FormScroll contentStyle={styles.content}>
      {error ? <ErrorBox text={error} /> : null}

      <Card>
        <SelectField label="Type" display={typeLabel(f.kind)} onPress={() => setPicker('kind')} icon="pricetag-outline" />
        <TextField label="Title *" value={f.title} onChangeText={(v) => set('title', v)} maxLength={160} placeholder="e.g. Submit TA bill" />
      </Card>

      <Card>
        <SectionLabel icon="calendar-outline" text="When" />
        <DateField label={f.multi_day ? 'Starts *' : 'Date *'} value={f.date} onChange={(v) => set('date', v)} />
        {f.multi_day ? (
          <DateField label="Ends" value={f.end_date} onChange={(v) => set('end_date', v)} minimumDate={new Date(`${f.date}T00:00:00`)} />
        ) : null}
        {!f.all_day ? (
          <View style={styles.row2}>
            <TimeField label="Start time" value={f.time} onChange={(v) => set('time', v || '10:00')} />
            <TimeField label="End time" value={f.end_time} onChange={(v) => set('end_time', v)} clearable />
          </View>
        ) : null}
        <SwitchRow label="All day" value={f.all_day} onChange={(v) => set('all_day', v)} />
        <SwitchRow label="Runs over several days" value={f.multi_day} onChange={(v) => set('multi_day', v)} />
        <Text style={styles.hint}>Times are Bangladesh time.</Text>
      </Card>

      <Card>
        <SectionLabel icon="repeat" text="Repeat" />
        <SelectField label="Repeat" display={FREQ_OPTIONS.find((o) => o.value === f.recurrence.freq)?.label ?? ''} onPress={() => setPicker('freq')} />
        {repeating ? (
          <>
            <SelectField
              label="Every"
              display={`${f.recurrence.interval} ${unit}${f.recurrence.interval > 1 ? 's' : ''}`}
              onPress={() => setPicker('interval')}
            />
            {f.recurrence.freq === 'weekly' ? (
              <View style={styles.chips}>
                {WEEKDAY_LABELS.map((label, idx) => {
                  const on = f.recurrence.weekdays.includes(idx);
                  return (
                    <Chip
                      key={label}
                      label={label}
                      on={on}
                      onPress={() => setRec({ weekdays: on ? f.recurrence.weekdays.filter((d) => d !== idx) : [...f.recurrence.weekdays, idx] })}
                    />
                  );
                })}
              </View>
            ) : null}
            {f.recurrence.freq === 'monthly' ? (
              <SelectField label="On day" display={monthDay === -1 ? 'Last day of month' : `Day ${monthDay}`} onPress={() => setPicker('month_day')} />
            ) : null}
            <DateField
              label="Until (optional)"
              value={f.recurrence.until ?? ''}
              onChange={(v) => setRec({ until: v || undefined })}
              minimumDate={new Date(`${f.date}T00:00:00`)}
            />
            <SelectField
              label="If it falls on Friday/Saturday"
              display={SHIFT_OPTIONS.find((o) => o.value === f.recurrence.weekend_shift)?.label ?? ''}
              onPress={() => setPicker('shift')}
            />
            <Text style={styles.hint}>{describeRecurrence(f.recurrence, f.date)}</Text>
          </>
        ) : null}
      </Card>

      <Card>
        <SectionLabel icon="notifications-outline" text="Remind me" />
        <View style={styles.chips}>
          {SCHEDULE_REMINDER_OPTIONS.map((o) => {
            const on = f.reminders.includes(o.minutes);
            return (
              <Chip
                key={o.minutes}
                label={o.label}
                on={on}
                disabled={!on && f.reminders.length >= 6}
                onPress={() => set('reminders', on ? f.reminders.filter((m) => m !== o.minutes) : [...f.reminders, o.minutes])}
              />
            );
          })}
        </View>
        <Text style={styles.hint}>
          Sent as an in-app notification and push.{f.all_day ? ' All-day items use the daily reminder time set by the admin.' : ''}
          {f.reminders.length === 0 ? ' No reminders selected.' : ''}
        </Text>
      </Card>

      <Card>
        <TextField label="Venue / place" value={f.location} onChangeText={(v) => set('location', v)} maxLength={300} placeholder="e.g. Conference room, 3rd floor" />
        <TextField
          label="Online meeting link"
          value={f.meeting_link}
          onChangeText={(v) => set('meeting_link', v)}
          placeholder="https://…"
          autoCapitalize="none"
          keyboardType="url"
        />
        <TextField
          label="Details"
          value={f.description}
          onChangeText={(v) => set('description', v)}
          maxLength={5000}
          multiline
          numberOfLines={4}
          style={styles.multiline}
        />
      </Card>

      <Button title={saving ? 'Saving…' : editing ? 'Save changes' : 'Save schedule'} loading={saving} disabled={saving} onPress={() => void save()} />

      {active ? (
        <PickerSheet
          visible
          title={active.title}
          options={active.options}
          value={active.value}
          onSelect={(o) => {
            active.onSelect(o.value);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </FormScroll>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  row2: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  multiline: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
});
