import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { addDays, bdTodayStr, expandOccurrences, type ScheduleEventRecord } from '@ibas/shared-types';
import { DateField } from '@/components/ui/DateField';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { PickerSheet, SelectField, type PickerOption } from '@/components/ui/PickerSheet';
import { TimeField } from '@/components/schedule/TimeField';
import { Chip, ErrorBox } from '@/components/schedule/ScheduleBits';
import { changeScheduleEvent, formatDayShort, originalOccurrence, slotText, type ScheduleChangeMode } from '@/lib/schedule-api';
import { colors, spacing } from '@/theme';

/** Postpone, cancel or restore a schedule (the whole schedule, or one date of a repeating one). */
export function ScheduleChangeSheet({
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
  const changed = ev.overrides.map((o) => o.date).sort();
  const startOcc = originalOccurrence(ev, occurrenceDate) ?? upcoming.find((d) => d >= today) ?? upcoming[0] ?? '';

  const [mode, setMode] = useState<ScheduleChangeMode>(initialMode);
  const [occ, setOcc] = useState(startOcc);
  const [scopeAll, setScopeAll] = useState(!recurring || (initialMode === 'restore' && ev.status === 'cancelled'));
  const override = ev.overrides.find((o) => o.date === occ);
  const current = recurring ? { date: override?.new_date ?? occ, time: override?.new_time ?? ev.time } : { date: ev.date, time: ev.time };
  const [newDate, setNewDate] = useState(current.date && current.date >= today ? addDays(current.date, 1) : addDays(today, 1));
  const [newTime, setNewTime] = useState(current.time ?? '');
  const [note, setNote] = useState('');
  const [pickOcc, setPickOcc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const canRestore = ev.status === 'cancelled' || ev.overrides.length > 0;
  const occChoices = Array.from(new Set([...upcoming, ...changed])).sort();
  const occOptions: PickerOption[] = (mode === 'restore' ? changed : occChoices).map((d) => {
    const o = ev.overrides.find((x) => x.date === d);
    const tag = o?.cancelled ? 'Cancelled' : o?.new_date ? `Moved to ${formatDayShort(o.new_date)}` : undefined;
    return { value: d, label: `${formatDayShort(d)}${d < today ? ' (past)' : ''}`, hint: tag };
  });
  const showOcc = recurring && !(mode !== 'postpone' && scopeAll);

  function switchMode(next: ScheduleChangeMode) {
    setMode(next);
    setError('');
    if (next === 'restore') setScopeAll(!recurring || ev.status === 'cancelled');
    if (next === 'restore' && recurring && ev.status !== 'cancelled' && !changed.includes(occ)) setOcc(changed[0] ?? '');
  }

  async function submit() {
    setError('');
    if (mode !== 'restore' && !note.trim()) return setError('Add a short note about why.');
    if (mode === 'postpone' && !newDate) return setError('Choose the new date.');
    if (recurring && mode === 'postpone' && !occ) return setError('Choose which date to postpone.');
    const occurrence_date = recurring && !(mode !== 'postpone' && scopeAll) ? occ || undefined : undefined;
    if (mode === 'restore' && recurring && !scopeAll && !occurrence_date) return setError('Choose which date to restore.');
    const body =
      mode === 'postpone'
        ? { occurrence_date, new_date: newDate, new_time: ev.time ? newTime : '', note: note.trim(), notify: false }
        : { occurrence_date, note: note.trim() || undefined, notify: false };
    setSaving(true);
    try {
      onDone(await changeScheduleEvent(ev.id, mode, body));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  const tabs: Array<{ id: ScheduleChangeMode; label: string }> = [
    { id: 'postpone', label: 'Postpone' },
    { id: 'cancel', label: 'Cancel' },
    ...(canRestore ? [{ id: 'restore' as const, label: 'Undo change' }] : []),
  ];

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <Text style={styles.title}>Change schedule</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            <View style={styles.chips}>
              {tabs.map((t) => (
                <Chip key={t.id} label={t.label} on={mode === t.id} onPress={() => switchMode(t.id)} />
              ))}
            </View>
            {error ? <ErrorBox text={error} /> : null}

            {recurring && mode !== 'postpone' ? (
              <View style={styles.chips}>
                <Chip label="One date only" on={!scopeAll} onPress={() => setScopeAll(false)} />
                <Chip
                  label={mode === 'cancel' ? 'All dates' : 'Whole schedule'}
                  on={scopeAll}
                  disabled={mode === 'restore' && ev.status !== 'cancelled'}
                  onPress={() => setScopeAll(true)}
                />
              </View>
            ) : null}

            {showOcc ? (
              <SelectField
                label="Which date"
                display={occ ? formatDayShort(occ) : ''}
                placeholder="Choose a date"
                onPress={() => setPickOcc(true)}
                icon="calendar-outline"
              />
            ) : null}

            {mode === 'postpone' ? (
              <>
                <Text style={styles.muted}>Currently: {current.date ? slotText(current.date, current.time) : '—'}</Text>
                <DateField label="New date *" value={newDate} onChange={setNewDate} minimumDate={new Date(`${today}T00:00:00`)} />
                {ev.time ? <TimeField label="New time" value={newTime} onChange={setNewTime} /> : null}
              </>
            ) : null}

            <TextField
              label={`Note ${mode === 'restore' ? '(optional)' : '*'}`}
              value={note}
              onChangeText={setNote}
              maxLength={1000}
              multiline
              numberOfLines={2}
              style={styles.multiline}
              placeholder={mode === 'postpone' ? 'e.g. Moved because of an official tour.' : mode === 'cancel' ? 'e.g. Not needed this time.' : 'e.g. Back to the original plan.'}
            />
            <Text style={styles.muted}>Only you see this schedule.</Text>

            <Button
              title={saving ? 'Saving…' : mode === 'postpone' ? 'Postpone' : mode === 'cancel' ? 'Cancel schedule' : 'Undo change'}
              loading={saving}
              disabled={saving}
              onPress={() => void submit()}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>

      <PickerSheet
        visible={pickOcc}
        title="Which date"
        options={occOptions}
        value={occ}
        onSelect={(o) => {
          setOcc(o.value);
          setPickOcc(false);
        }}
        onClose={() => setPickOcc(false)}
        emptyText="No dates to choose from"
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  body: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  muted: {
    fontSize: 12,
    color: colors.textMuted,
  },
  multiline: {
    minHeight: 64,
    textAlignVertical: 'top',
  },
});
