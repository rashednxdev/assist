import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookError } from '@/components/books/BookStates';
import { BookRichText } from '@/components/books/BookRichText';
import { fetchExamRoutineByExamName, type ExamRoutineDetail } from '@/lib/exam-routine-api';
import { formatDdMmYyyy, formatDayName, parseIsoDate } from '@/lib/date-format';
import { colors, spacing } from '@/theme';

const ROUTINE_ACCENT = '#7c2d12';
const ROUTINE_ACCENT_LIGHT = '#fef0e8';

function daysUntil(iso: string): number {
  const target = parseIsoDate(iso);
  if (!target) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function dayNumber(iso: string): string {
  return iso.slice(8, 10);
}

function monthAbbrev(iso: string): string {
  const date = parseIsoDate(iso);
  if (!date) return '';
  return date.toLocaleDateString(undefined, { month: 'short' }).toUpperCase();
}

/** "HH:mm" (24h, as stored) -> "h:mm AM/PM" for display. */
function formatTime12h(time: string): string {
  const m = /^(\d{2}):(\d{2})$/.exec(time);
  if (!m) return time;
  const hour24 = Number(m[1]);
  const minute = m[2];
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${minute} ${period}`;
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
        {routine.start_date_note?.trim() ? (
          <Text style={styles.startNote}>{routine.start_date_note.trim()}</Text>
        ) : null}
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
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => setExpandedId(expanded ? null : e.id)}
              disabled={!e.instruction}
            >
              <View style={styles.cardTop}>
                <View style={styles.dateTile}>
                  <Text style={styles.dateTileWeekday}>{formatDayName(e.date).slice(0, 3).toUpperCase()}</Text>
                  <Text style={styles.dateTileDay}>{dayNumber(e.date)}</Text>
                  <Text style={styles.dateTileMonth}>{monthAbbrev(e.date)}</Text>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.subjectName}>{e.subject_name}</Text>
                  <Text style={styles.fullDate}>
                    {formatDayName(e.date)}, {formatDdMmYyyy(e.date)}
                  </Text>
                  <View style={styles.timePill}>
                    <Ionicons name="time-outline" size={14} color={ROUTINE_ACCENT} />
                    <Text style={styles.timeText}>{formatTime12h(e.time)}</Text>
                  </View>
                </View>

                {e.instruction && (
                  <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={22}
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
    gap: spacing.md,
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
  startNote: {
    fontSize: 12,
    color: '#92400e',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 17,
    paddingHorizontal: spacing.md,
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
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dateTile: {
    width: 60,
    height: 68,
    borderRadius: 14,
    backgroundColor: ROUTINE_ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  dateTileWeekday: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  dateTileDay: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.white,
    lineHeight: 28,
  },
  dateTileMonth: {
    fontSize: 11,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    letterSpacing: 0.5,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  subjectName: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  fullDate: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    backgroundColor: ROUTINE_ACCENT_LIGHT,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  timeText: {
    fontSize: 13,
    fontWeight: '800',
    color: ROUTINE_ACCENT,
  },
  instructionWrap: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
