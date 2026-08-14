import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, TextInput } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookBadge } from '@/components/books/BookBadge';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { ProgressSummary } from '@/components/evaluation/ProgressSummary';
import { fetchPaperEvaluation, type ProgressSummary as ProgressSummaryData } from '@/lib/evaluation-api';
import { paperHeadingLines } from '@/lib/paper-display';
import { fetchPapers, fetchPaperTypes } from '@/lib/papers-api';
import { paperDetailHref } from '@/lib/paper-routes';
import { isDeviceOnline, showToast } from '@/lib/toast';
import { useAuth } from '@/lib/auth-context';
import type { PaperItem, PaperType } from '@/types/papers';
import { colors, spacing } from '@/theme';

export default function PapersScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const isAdmin =
    user?.is_super_admin || user?.user_type === 'system_admin' || user?.user_type === 'admin';
  const offlineToastShown = useRef(false);
  const refreshUserRef = useRef(refreshUser);
  refreshUserRef.current = refreshUser;

  const [items, setItems] = useState<PaperItem[]>([]);
  const [types, setTypes] = useState<PaperType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [typeId, setTypeId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [status, setStatus] = useState('');
  const [progressByPaperId, setProgressByPaperId] = useState<Record<string, ProgressSummaryData>>({});

  const notifyOffline = useCallback(async () => {
    const online = await isDeviceOnline();
    if (!online) {
      if (!offlineToastShown.current) {
        showToast('You are offline');
        offlineToastShown.current = true;
      }
      return false;
    }
    offlineToastShown.current = false;
    return true;
  }, []);

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
    const online = await notifyOffline();
    if (!online) {
      setLoading(false);
      setItems((prev) => {
        if (prev.length === 0) setError('You are offline');
        return prev;
      });
      return;
    }
    try {
      const [paperRows, typeRows] = await Promise.all([
        fetchPapers({ is_published: status as 'true' | 'false' | '' }),
        fetchPaperTypes(),
      ]);
      setItems(paperRows);
      setTypes(typeRows);
      void loadProgress(paperRows);
    } catch {
      const onlineNow = await isDeviceOnline();
      if (!onlineNow) {
        showToast('You are offline');
        setItems((prev) => {
          if (prev.length === 0) setError('You are offline');
          return prev;
        });
      } else {
        setError('Failed to load papers');
      }
    } finally {
      setLoading(false);
    }
  }, [status, loadProgress, notifyOffline]);

  const loadRef = useRef(load);
  loadRef.current = load;
  const hasEnteredPapers = useRef(false);

  // Load once when entering Papers — do not depend on `load`/`user` or refreshUser will loop.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      hasEnteredPapers.current = true;
      void notifyOffline();
      void refreshUserRef
        .current()
        .catch(() => null)
        .then(() => {
          if (!cancelled) return loadRef.current();
        });
      return () => {
        cancelled = true;
      };
    }, [notifyOffline]),
  );

  // Re-fetch when the published filter changes while staying on this screen.
  useEffect(() => {
    if (!hasEnteredPapers.current) return;
    void load();
  }, [status]);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of items) {
      if (!item.exam_subject_id) continue;
      if (map.has(item.exam_subject_id)) continue;
      const label =
        item.exam_subject_name_bn?.trim() ||
        item.exam_subject_name?.trim() ||
        'Subject';
      map.set(item.exam_subject_id, label);
    }
    return [...map.entries()]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [items]);

  useEffect(() => {
    if (subjectId && !subjectOptions.some((s) => s.id === subjectId)) {
      setSubjectId('');
    }
  }, [subjectId, subjectOptions]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (typeId && item.paper_type_id !== typeId) return false;
      if (subjectId && item.exam_subject_id !== subjectId) return false;
      if (!q) return true;
      const heading = paperHeadingLines(item);
      const line = [
        item.name,
        heading.examLine,
        heading.subjectLine,
        item.paper_type_name,
        item.exam_short_name,
        item.exam_subject_name,
        item.exam_subject_name_bn,
        item.session_label_en,
        item.session_label_bn,
      ]
        .join(' ')
        .toLowerCase();
      return line.includes(q);
    });
  }, [items, query, typeId, subjectId]);

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
        {subjectOptions.length > 0 ? (
          <FlatList
            horizontal
            data={[{ id: '', label: 'All Subjects' }, ...subjectOptions]}
            keyExtractor={(item) => `subject-${item.id || 'all'}`}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
            renderItem={({ item }) => (
              <Pressable
                style={[styles.chip, subjectId === item.id && styles.chipActive]}
                onPress={() => setSubjectId(item.id)}
              >
                <Text style={[styles.chipText, subjectId === item.id && styles.chipTextActive]}>
                  {item.label}
                </Text>
              </Pressable>
            )}
          />
        ) : null}
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
      ) : error && items.length === 0 ? (
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
            const { paperName, examLine, subjectLine } = paperHeadingLines(item);
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
                  <View style={styles.headingBlock}>
                    <Text style={styles.paperName}>{paperName}</Text>
                    {examLine ? <Text style={styles.examLine}>{examLine}</Text> : null}
                    {subjectLine ? <Text style={styles.subjectLine}>{subjectLine}</Text> : null}
                  </View>
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
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyWrap: {
    flex: 1,
    gap: 6,
  },
  headingBlock: {
    alignItems: 'center',
    gap: 6,
    width: '100%',
  },
  paperName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 22,
  },
  examLine: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  subjectLine: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
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
