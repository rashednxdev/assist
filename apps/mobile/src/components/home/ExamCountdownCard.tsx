import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchExamRoutineList, type ExamRoutineListItem } from '@/lib/exam-routine-api';
import { formatDdMmYyyy, normalizeToIsoDate, parseIsoDate } from '@/lib/date-format';
import { colors, spacing } from '@/theme';

function daysUntil(raw: string): number | null {
  const iso = normalizeToIsoDate(raw) ?? (parseIsoDate(raw) ? raw.trim() : null);
  if (!iso) return null;
  const target = parseIsoDate(iso);
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function pickNearest(routines: ExamRoutineListItem[]) {
  const scored = routines
    .map((r) => ({ ...r, days: daysUntil(r.start_date) }))
    .filter((r): r is ExamRoutineListItem & { days: number } => r.days != null);

  const upcoming = scored.filter((r) => r.days >= 0).sort((a, b) => a.days - b.days);
  if (upcoming[0]) return upcoming[0];

  // If every published start date is in the past, still show the closest one
  // so the home countdown does not disappear after exam day.
  const past = scored.filter((r) => r.days < 0).sort((a, b) => b.days - a.days);
  return past[0] ?? null;
}

function countdownLabel(days: number): { number: string; unit: string } {
  if (days > 0) return { number: String(days), unit: days === 1 ? 'day' : 'days' };
  if (days === 0) return { number: '0', unit: 'today' };
  const ago = Math.abs(days);
  return { number: String(ago), unit: ago === 1 ? 'day ago' : 'days ago' };
}

/** Nearest exam from Exam Routine — shown above Learning modules on the home dashboard. */
export function ExamCountdownCard() {
  const router = useRouter();
  const [routines, setRoutines] = useState<ExamRoutineListItem[] | null>(null);

  const load = useCallback(() => {
    fetchExamRoutineList()
      .then((res) => setRoutines(Array.isArray(res.data) ? res.data : []))
      .catch(() => setRoutines([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!routines || routines.length === 0) return null;

  const nearest = pickNearest(routines);
  if (!nearest) return null;

  const label = countdownLabel(nearest.days);
  const displayDate = normalizeToIsoDate(nearest.start_date) ?? nearest.start_date;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/(app)/exam-routine/${nearest.exam_name_id}` as Href)}
      accessibilityRole="button"
      accessibilityLabel={`Exam countdown for ${nearest.exam_name}`}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="timer-outline" size={22} color="#92400e" />
      </View>
      <View style={styles.body}>
        <Text style={styles.kicker}>Exam routine</Text>
        <Text style={styles.title}>{nearest.exam_name}</Text>
        <Text style={styles.sub}>
          {nearest.days >= 0 ? 'Starts' : 'Started'} {formatDdMmYyyy(displayDate)}
        </Text>
        {nearest.start_date_note?.trim() ? (
          <Text style={styles.note} numberOfLines={2}>
            {nearest.start_date_note.trim()}
          </Text>
        ) : null}
      </View>
      <View style={styles.countdownWrap}>
        <Text style={styles.countdownNumber}>{label.number}</Text>
        <Text style={styles.countdownUnit}>{label.unit}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#fffbeb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    padding: spacing.md,
  },
  cardPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: 2,
  },
  kicker: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: '#92400e',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  note: {
    fontSize: 11,
    color: '#92400e',
    marginTop: 2,
    lineHeight: 15,
  },
  countdownWrap: {
    alignItems: 'center',
    minWidth: 52,
  },
  countdownNumber: {
    fontSize: 22,
    fontWeight: '900',
    color: '#92400e',
  },
  countdownUnit: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
    textAlign: 'center',
  },
});
