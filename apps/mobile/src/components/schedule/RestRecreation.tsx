import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addYears, bdTodayStr, daysBetween } from '@ibas/shared-types';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { Button } from '@/components/ui/Button';
import { Card, ErrorBox, SectionLabel, Tag } from '@/components/schedule/ScheduleBits';
import { formatDayLong, formatDayShort, saveScheduleProfile, type RestRecreationData } from '@/lib/schedule-api';
import { showToast } from '@/lib/toast';
import { colors, spacing } from '@/theme';

const TEAL = '#0f766e';

type HistoryRow = { start_date: string; end_date: string; note: string };

export function RestRecreationSummary({ data, light }: { data: RestRecreationData | null; light?: boolean }) {
  if (!data) return <ActivityIndicator color={light ? colors.white : TEAL} />;
  const s = data.status;
  const muted = light ? styles.mutedLight : styles.muted;
  if (!s.due_date || s.days_left === undefined) {
    return <Text style={muted}>Add your joining date to see when rest & recreation leave is due.</Text>;
  }
  const total = daysBetween(s.basis_date!, s.due_date);
  const pct = Math.min(100, Math.max(0, ((total - Math.max(0, s.days_left)) / Math.max(1, total)) * 100));
  return (
    <View style={styles.summary}>
      <View style={styles.summaryTop}>
        <Text style={[styles.big, light && styles.textLight]}>
          {s.eligible ? 'Due now' : `${s.days_left} day${s.days_left === 1 ? '' : 's'}`}
          {!s.eligible ? <Text style={muted}> left</Text> : null}
        </Text>
        <Text style={[styles.due, light && styles.textLight]}>
          {s.eligible ? `Eligible since ${formatDayShort(s.due_date)}` : `Due ${formatDayShort(s.due_date)}`}
        </Text>
      </View>
      <View style={[styles.track, light && styles.trackLight]}>
        <View style={[styles.fill, { width: `${pct}%` }, s.eligible && styles.fillDone]} />
      </View>
      <Text style={[muted, styles.small]}>
        {s.leave_days} days every {s.cycle_years} years · counted from {s.basis === 'joining' ? 'joining date' : 'last R&R leave'} (
        {formatDayShort(s.basis_date!)})
      </Text>
    </View>
  );
}

export function RestRecreationPanel({ data, onSaved }: { data: RestRecreationData | null; onSaved: (d: RestRecreationData) => void }) {
  const [joining, setJoining] = useState('');
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [reminders, setReminders] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!data) return;
    setJoining(data.profile.joining_date ?? '');
    setRows(data.profile.rr_history.map((h) => ({ start_date: h.start_date, end_date: h.end_date ?? '', note: h.note ?? '' })));
    setReminders(data.profile.rr_reminders);
  }, [data]);

  async function save() {
    setError('');
    const bad = rows.find((r) => r.start_date && r.end_date && r.end_date < r.start_date);
    if (bad) return setError('A leave ends before it starts.');
    setSaving(true);
    try {
      const d = await saveScheduleProfile({
        joining_date: joining,
        rr_history: rows
          .filter((h) => h.start_date)
          .map((h) => ({ start_date: h.start_date, end_date: h.end_date, note: h.note.trim() || undefined })),
        rr_reminders: reminders,
      });
      onSaved(d);
      showToast('Saved. Your reminders are updated.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (!data) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={TEAL} />
      </View>
    );
  }
  const s = data.status;
  const today = new Date(`${bdTodayStr()}T00:00:00`);
  const setRow = (idx: number, patch: Partial<HistoryRow>) => setRows(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <View style={styles.panel}>
      <Card>
        <SectionLabel icon="calendar-outline" text="Next rest & recreation" />
        <RestRecreationSummary data={data} />
        {s.due_date ? (
          <View style={styles.infoBox}>
            <Text style={styles.small}>
              Eligible from <Text style={styles.strong}>{formatDayLong(s.due_date)}</Text>
            </Text>
            <Text style={[styles.small, styles.muted]}>
              The cycle after that would be due around {formatDayShort(addYears(s.due_date, s.cycle_years))} if taken on time.
            </Text>
          </View>
        ) : null}
      </Card>

      <Card>
        <SectionLabel icon="briefcase-outline" text="My service dates" />
        {error ? <ErrorBox text={error} /> : null}
        <DateField label="Date of joining government service" value={joining} onChange={setJoining} maximumDate={today} />

        <Text style={styles.label}>Rest & recreation leave already taken</Text>
        <Text style={[styles.small, styles.muted]}>Add each R&R leave you have enjoyed. The next cycle counts from the most recent one.</Text>
        {rows.map((r, idx) => (
          <View key={idx} style={styles.leave}>
            <View style={styles.leaveHead}>
              <Tag label={`Leave ${idx + 1}`} tone="info" />
              <Pressable onPress={() => setRows(rows.filter((_, i) => i !== idx))} hitSlop={8} accessibilityLabel="Remove leave">
                <Ionicons name="trash-outline" size={18} color={colors.error} />
              </Pressable>
            </View>
            <DateField label="From" value={r.start_date} onChange={(v) => setRow(idx, { start_date: v })} maximumDate={today} />
            <DateField
              label="To"
              value={r.end_date}
              onChange={(v) => setRow(idx, { end_date: v })}
              minimumDate={r.start_date ? new Date(`${r.start_date}T00:00:00`) : undefined}
            />
            <TextField label="Note (order no.)" value={r.note} maxLength={200} onChangeText={(v) => setRow(idx, { note: v })} />
          </View>
        ))}
        {rows.length < 30 ? (
          <Pressable style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]} onPress={() => setRows([...rows, { start_date: '', end_date: '', note: '' }])}>
            <Ionicons name="add" size={18} color={TEAL} />
            <Text style={styles.addText}>Add leave</Text>
          </Pressable>
        ) : null}

        <SwitchRow
          label="R&R reminders"
          hint={`Remind me ${data.settings.rr_reminder_days.map((d) => (d === 0 ? 'on the day' : `${d} days before`)).join(', ')}`}
          value={reminders}
          onChange={setReminders}
        />
        <Button title={saving ? 'Saving…' : 'Save'} loading={saving} disabled={saving} onPress={() => void save()} />
      </Card>

      <Card>
        <Text style={styles.strong}>How it is calculated</Text>
        <Text style={[styles.small, styles.muted]}>
          {data.settings.rr_days} days of rest & recreation leave (শ্রান্তি ও বিনোদন ছুটি) become due every {data.settings.rr_cycle_years} years — first
          from the joining date, then from the{' '}
          {data.settings.rr_count_from === 'leave_end' ? 'day after your last R&R leave ended' : 'first day of your last R&R leave'}.
        </Text>
        <Text style={[styles.small, styles.muted]}>These rules are set by the admin. Check the current government order before applying.</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  loading: {
    padding: spacing.lg,
    alignItems: 'center',
  },
  panel: {
    gap: spacing.md,
  },
  summary: {
    gap: 6,
  },
  summaryTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  big: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  due: {
    fontSize: 12,
    fontWeight: '700',
    color: TEAL,
  },
  textLight: {
    color: colors.white,
  },
  muted: {
    color: colors.textMuted,
    fontSize: 13,
  },
  mutedLight: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
  },
  small: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.text,
  },
  strong: {
    fontWeight: '700',
    color: colors.text,
  },
  track: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  trackLight: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  fill: {
    height: '100%',
    backgroundColor: '#0d9488',
  },
  fillDone: {
    backgroundColor: '#10b981',
  },
  infoBox: {
    gap: 4,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    padding: spacing.sm + 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  leave: {
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
  },
  leaveHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  addText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEAL,
  },
});
