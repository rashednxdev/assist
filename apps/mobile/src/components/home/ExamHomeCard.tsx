import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ProgressDashboardData } from '@/lib/evaluation-api';
import { fetchExamRoutineList, type ExamRoutineListItem } from '@/lib/exam-routine-api';
import { normalizeToIsoDate, parseIsoDate } from '@/lib/date-format';
import { colors, spacing } from '@/theme';

const BLUE_BORDER = '#bfdbfe';

function daysUntil(raw: string): number | null {
  const target = parseIsoDate(normalizeToIsoDate(raw) ?? raw.trim());
  if (!target) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function nextExam(routines: ExamRoutineListItem[]): { name: string; days: number } | null {
  const upcoming = routines
    .map((r) => ({ name: r.exam_name, days: daysUntil(r.start_date) }))
    .filter((r): r is { name: string; days: number } => r.days != null && r.days >= 0)
    .sort((a, b) => a.days - b.days);
  return upcoming[0] ?? null;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

/** Home card: exam progress at a glance, with the way into every exam-preparation module. */
export function ExamHomeCard({
  progress,
  savedCount,
  qotdChecking,
  onOpen,
  onQotd,
}: {
  progress: ProgressDashboardData | null;
  savedCount: number;
  qotdChecking: boolean;
  onOpen: () => void;
  onQotd: () => void;
}) {
  const [exam, setExam] = useState<{ name: string; days: number } | null>(null);

  useFocusEffect(
    useCallback(() => {
      fetchExamRoutineList()
        .then((res) => setExam(nextExam(Array.isArray(res.data) ? res.data : [])))
        .catch(() => setExam(null));
    }, []),
  );

  const mcq = progress?.mcq.accuracy_percent ?? 0;
  const papers = progress?.papers.average_progress_percent ?? 0;

  return (
    <View style={styles.card}>
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
        <View style={styles.icon}>
          <Ionicons name="school" size={26} color={colors.white} />
        </View>
        <View style={styles.body}>
          <Text style={styles.title}>Exam Preparation</Text>
          <Text style={styles.sub}>Books, question bank, papers, live class, routine & more</Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      <Pressable onPress={onOpen} style={({ pressed }) => [styles.stats, pressed && styles.pressed]}>
        <Stat label="MCQ accuracy" value={`${mcq}%`} />
        <View style={styles.divider} />
        <Stat label="Papers progress" value={`${papers}%`} />
        <View style={styles.divider} />
        <Stat label="Saved" value={String(savedCount)} />
      </Pressable>

      {exam ? (
        <View style={styles.exam}>
          <Ionicons name="timer-outline" size={15} color="#92400e" />
          <Text style={styles.examText} numberOfLines={1}>
            {exam.name}
          </Text>
          <Text style={styles.examDays}>
            {exam.days === 0 ? 'Today' : `${exam.days} day${exam.days === 1 ? '' : 's'} left`}
          </Text>
        </View>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          style={({ pressed }) => [styles.btn, styles.btnSolid, pressed && styles.pressed]}
          onPress={onQotd}
          disabled={qotdChecking}
        >
          {qotdChecking ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="calendar" size={15} color={colors.white} />
          )}
          <Text style={[styles.btnText, styles.btnTextSolid]}>Question of the Day</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={onOpen}>
          <Text style={styles.btnText}>All modules</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.primaryDark} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BLUE_BORDER,
    backgroundColor: '#f5f9ff',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  icon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BLUE_BORDER,
    paddingVertical: 10,
  },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statValue: { fontSize: 18, fontWeight: '800', color: colors.primaryDark },
  statLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted },
  divider: { width: 1, alignSelf: 'stretch', backgroundColor: BLUE_BORDER },
  exam: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  examText: { flex: 1, fontSize: 12, fontWeight: '700', color: colors.text },
  examDays: { fontSize: 12, fontWeight: '800', color: '#92400e' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: BLUE_BORDER,
    backgroundColor: colors.surface,
  },
  btnSolid: { backgroundColor: colors.primary, borderColor: colors.primary },
  btnText: { fontSize: 13, fontWeight: '700', color: colors.primaryDark },
  btnTextSolid: { color: colors.white },
  pressed: { opacity: 0.85 },
});
