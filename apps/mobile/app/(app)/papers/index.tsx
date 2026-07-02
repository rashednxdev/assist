import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { ProgressSummary } from '@/components/evaluation/ProgressSummary';
import { fetchPaperEvaluation, type ProgressSummary as ProgressSummaryData } from '@/lib/evaluation-api';
import { fetchPapers, fetchPaperTypes } from '@/lib/papers-api';
import { paperDetailHref } from '@/lib/paper-routes';
import { useAuth } from '@/lib/auth-context';
import type { PaperItem, PaperType } from '@/types/papers';
import { colors, spacing } from '@/theme';

export default function PapersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin =
    user?.is_super_admin || user?.user_type === 'system_admin' || user?.user_type === 'admin';

  const [items, setItems] = useState<PaperItem[]>([]);
  const [types, setTypes] = useState<PaperType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeId, setTypeId] = useState('');
  const [status, setStatus] = useState('');
  const [progressByPaperId, setProgressByPaperId] = useState<Record<string, ProgressSummaryData>>({});

  const loadProgress = useCallback(async (papers: PaperItem[]) => {
    const published = papers.filter((paper) => paper.is_published);
    const entries = await Promise.all(
      published.map(async (paper) => {
        try {
          const evaluation = await fetchPaperEvaluation(paper.id);
          return [paper.id, evaluation.overall] as const;
        } catch {
          return null;
        }
      }),
    );
    const next: Record<string, ProgressSummaryData> = {};
    for (const entry of entries) {
      if (entry) next[entry[0]] = entry[1];
    }
    setProgressByPaperId(next);
  }, []);

  const load = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const [paperRows, typeRows] = await Promise.all([
        fetchPapers({ is_published: status as 'true' | 'false' | '' }),
        fetchPaperTypes(),
      ]);
      setItems(paperRows);
      setTypes(typeRows);
      void loadProgress(paperRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load papers');
    } finally {
      setLoading(false);
    }
  }, [status, loadProgress]);

  useFocusEffect(
    useCallback(() => {
      if (items.length > 0) void loadProgress(items);
    }, [items, loadProgress]),
  );

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (typeId && item.paper_type_id !== typeId) return false;
      if (!q) return true;
      const line = [
        item.name,
        item.paper_type_name,
        item.exam_short_name,
        item.exam_subject_name,
        item.session_label_en,
      ]
        .join(' ')
        .toLowerCase();
      return line.includes(q);
    });
  }, [items, query, typeId]);

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search paper, subject, or exam..."
            placeholderTextColor={colors.textMuted}
          />
        </View>
      </View>

      <View style={styles.filters}>
        <FlatList
          horizontal
          data={[{ id: '', label: 'All Types' }, ...types.map((t) => ({ id: t.id, label: t.name }))]}
          keyExtractor={(item) => `type-${item.id || 'all'}`}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.chip, typeId === item.id && styles.chipActive]}
              onPress={() => setTypeId(item.id)}
            >
              <Text style={[styles.chipText, typeId === item.id && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          )}
        />
        {isAdmin ? (
          <FlatList
            horizontal
            data={[
              { id: '', label: 'All Status' },
              { id: 'true', label: 'Published' },
              { id: 'false', label: 'Draft' },
            ]}
            keyExtractor={(item) => `status-${item.id || 'all'}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.chip, status === item.id && styles.chipActive]}
                onPress={() => setStatus(item.id)}
              >
                <Text style={[styles.chipText, status === item.id && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        ) : null}
      </View>

      {loading && items.length === 0 ? (
        <BookLoading />
      ) : error ? (
        <BookError message={error} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <BookEmpty title="No papers found" subtitle="Try a different search or filter." />
          }
          renderItem={({ item }) => {
            const progress = progressByPaperId[item.id];
            return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push(paperDetailHref(item.id))}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="document-text-outline" size={20} color="#d97706" />
              </View>
              <View style={styles.bodyWrap}>
                <Text style={styles.title}>{item.name}</Text>
                <Text style={styles.meta}>
                  {[item.exam_short_name, item.exam_subject_name, item.session_label_en]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                {progress && progress.total_questions > 0 ? (
                  <View style={styles.progressWrap}>
                    <Text style={styles.progressLabel}>Overall evaluation</Text>
                    <ProgressSummary summary={progress} size="sm" />
                  </View>
                ) : null}
                <View style={styles.badges}>
                  <BookBadge label={item.paper_type_name ?? 'Paper'} variant="muted" />
                  <BookBadge label={`${item.total_marks} marks`} variant="muted" />
                  <BookBadge label={`${item.duration_minutes} min`} variant="muted" />
                  <BookBadge label={`${item.question_count} questions`} variant="muted" />
                  {isAdmin ? (
                    <BookBadge label={item.is_published ? 'Published' : 'Draft'} variant="muted" />
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  filters: {
    gap: 6,
    paddingBottom: spacing.sm,
  },
  chips: {
    paddingHorizontal: spacing.md,
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  chipTextActive: {
    color: colors.white,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  bodyWrap: {
    flex: 1,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  meta: {
    fontSize: 13,
    color: colors.textMuted,
  },
  progressWrap: {
    gap: 4,
    marginTop: 2,
  },
  progressLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  pressed: {
    opacity: 0.9,
  },
});
