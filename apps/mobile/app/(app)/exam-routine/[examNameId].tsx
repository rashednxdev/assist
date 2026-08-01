import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookError } from '@/components/books/BookStates';
import { BookRichText } from '@/components/books/BookRichText';
import { fetchExamRoutineByExamName, type ExamRoutineDetail } from '@/lib/exam-routine-api';
import { formatDdMmYyyy, formatDayName, parseIsoDate } from '@/lib/date-format';
import { colors, spacing } from '@/theme';

function daysUntil(iso: string): number {
  const target = parseIsoDate(iso);
  if (!target) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export default function ExamRoutineDetailScreen() {
  const { examNameId } = useLocalSearchParams<{ examNameId: string }>();
  const [routine, setRoutine] = useState<ExamRoutineDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!examNameId) return;
    setLoading(true);
    fetchExamRoutineByExamName(examNameId)
      .then((res) => setRoutine(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [examNameId]);

  if (loading) return <BookLoading />;
  if (error) return <BookError message={error} />;
  if (!routine) return <BookError message="Routine not found" />;

  const days = daysUntil(routine.start_date);

  return (
    <ScrollView contentContainerStyle={styles.list}>
      <View style={styles.header}>
        <Text style={styles.examName}>{routine.exam_name}</Text>
        <Text style={styles.startLabel}>Starts {formatDdMmYyyy(routine.start_date)}</Text>
        <View style={styles.countdownWrap}>
          <Text style={styles.countdownNumber}>{Math.abs(days)}</Text>
          <Text style={styles.countdownUnit}>
            {days > 0 ? 'days left' : days === 0 ? 'today' : 'days ago'}
          </Text>
        </View>
      </View>

      {routine.entries.length === 0 ? (
        <Text style={styles.empty}>No subjects added to this routine yet.</Text>
      ) : (
        routine.entries.map((e) => {
          const expanded = expandedId === e.id;
          return (
            <Pressable
              key={e.id}
              style={styles.card}
              onPress={() => setExpandedId(expanded ? null : e.id)}
              disabled={!e.instruction}
            >
              <View style={styles.cardTop}>
                <View style={styles.cardBody}>
                  <Text style={styles.subjectName}>{e.subject_name}</Text>
                  <Text style={styles.subjectMeta}>
                    {formatDayName(e.date)}, {formatDdMmYyyy(e.date)} · {e.time}
                  </Text>
                </View>
                {e.instruction && (
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                )}
              </View>
              {expanded && e.instruction && (
                <View style={styles.instructionWrap}>
                  <BookRichText html={e.instruction} />
                </View>
              )}
            </Pressable>
          );
        })
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  header: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.sm,
  },
  examName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  startLabel: {
    fontSize: 13,
    color: colors.textMuted,
  },
  countdownWrap: {
    marginTop: spacing.sm,
    alignItems: 'center',
  },
  countdownNumber: {
    fontSize: 36,
    fontWeight: '900',
    color: colors.primary,
  },
  countdownUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  empty: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  cardBody: {
    flex: 1,
    gap: 2,
  },
  subjectName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  subjectMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  instructionWrap: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
