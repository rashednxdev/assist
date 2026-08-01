import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookLoading, BookEmpty, BookError } from '@/components/books/BookStates';
import {
  fetchMySubmittedQuestions,
  type MySubmittedQuestionRecord,
} from '@/lib/user-questions-api';
import { questionDetailHref } from '@/lib/question-routes';
import { colors, spacing } from '@/theme';

function truncate(text: string, len = 160) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

function statusMeta(status: MySubmittedQuestionRecord['status']) {
  if (status === 'accepted') return { label: 'Accepted & answered', color: '#16a34a', bg: '#dcfce7' };
  if (status === 'rejected') return { label: 'Rejected', color: '#dc2626', bg: '#fee2e2' };
  return { label: 'Pending review', color: '#d97706', bg: '#fef3c7' };
}

export default function UserQuestionsScreen() {
  const router = useRouter();
  const [rows, setRows] = useState<MySubmittedQuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetchMySubmittedQuestions();
      setRows(res.data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  function onPressRow(row: MySubmittedQuestionRecord) {
    if (row.status === 'accepted' && row.linked_question_id) {
      router.push(questionDetailHref(row.linked_question_id));
    }
  }

  return (
    <View style={styles.root}>
      <Pressable
        style={({ pressed }) => [styles.submitBtn, pressed && styles.submitBtnPressed]}
        onPress={() => router.push('/(app)/user-questions/new' as Href)}
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.white} />
        <Text style={styles.submitBtnText}>Submit a question</Text>
      </Pressable>

      {loading ? (
        <BookLoading />
      ) : error ? (
        <BookError message={error} />
      ) : rows.length === 0 ? (
        <BookEmpty
          title="No submitted questions yet"
          subtitle="Couldn't find a question under a subject? Submit it for an admin to review."
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load();
              }}
            />
          }
        >
          {rows.map((row) => {
            const meta = statusMeta(row.status);
            const tappable = row.status === 'accepted' && row.linked_question_id;
            return (
              <Pressable
                key={row.id}
                style={({ pressed }) => [styles.card, pressed && tappable && styles.cardPressed]}
                onPress={() => onPressRow(row)}
                disabled={!tappable}
              >
                <View style={styles.cardTop}>
                  <Text style={styles.subjectName}>{row.subject_name}</Text>
                  <View style={[styles.badge, { backgroundColor: meta.bg }]}>
                    <Text style={[styles.badgeText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                </View>
                <Text style={styles.body} numberOfLines={4}>
                  {truncate(row.body)}
                </Text>
                {row.admin_note && <Text style={styles.note}>Note: {row.admin_note}</Text>}
                {tappable && (
                  <View style={styles.tapHint}>
                    <Text style={styles.tapHintText}>Tap to view the answer</Text>
                    <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    margin: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
  },
  submitBtnPressed: {
    opacity: 0.9,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  list: {
    padding: spacing.md,
    paddingTop: 0,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  cardPressed: {
    opacity: 0.92,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  subjectName: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  body: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 19,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 4,
  },
  tapHintText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
});
