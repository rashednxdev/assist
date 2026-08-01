import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchExamRoutineList, type ExamRoutineListItem } from '@/lib/exam-routine-api';
import { parseIsoDate, formatDdMmYyyy } from '@/lib/date-format';
import { colors, spacing } from '@/theme';

function daysUntil(iso: string): number {
  const target = parseIsoDate(iso);
  if (!target) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** Nearest upcoming exam from the Exam Routine module, shown as a countdown on the home dashboard. */
export function ExamCountdownCard() {
  const router = useRouter();
  const [routines, setRoutines] = useState<ExamRoutineListItem[] | null>(null);

  useEffect(() => {
    fetchExamRoutineList()
      .then((res) => setRoutines(res.data))
      .catch(() => setRoutines([]));
  }, []);

  if (!routines || routines.length === 0) return null;

  const nearest = routines
    .map((r) => ({ ...r, days: daysUntil(r.start_date) }))
    .filter((r) => r.days >= 0)
    .sort((a, b) => a.days - b.days)[0];

  if (!nearest) return null;

  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => router.push(`/(app)/exam-routine/${nearest.exam_name_id}` as Href)}
    >
      <View style={styles.iconWrap}>
        <Ionicons name="timer-outline" size={22} color="#92400e" />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{nearest.exam_name}</Text>
        <Text style={styles.sub}>Starts {formatDdMmYyyy(nearest.start_date)}</Text>
      </View>
      <View style={styles.countdownWrap}>
        <Text style={styles.countdownNumber}>{nearest.days}</Text>
        <Text style={styles.countdownUnit}>{nearest.days === 1 ? 'day' : 'days'}</Text>
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
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  countdownWrap: {
    alignItems: 'center',
    minWidth: 44,
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
  },
});
