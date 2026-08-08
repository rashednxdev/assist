import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { BookRichText } from '@/components/books/BookRichText';
import { RatingIndicator } from '@/components/evaluation/RatingIndicator';
import { fetchQuestionEvaluationsBatch, type QuestionEvalBrief } from '@/lib/evaluation-api';
import { SwipeToRemove } from '@/components/saved/SwipeToRemove';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { removeSavedShortcut, type SavedShortcut } from '@/lib/saved-shortcuts';
import { fetchQuestionDetail } from '@/lib/questions-api';
import { stripHtml } from '@/lib/book-display';
import type { ExplanationSection, QuestionDetail } from '@/types/questions';
import { colors, spacing } from '@/theme';

type ShowMode = 'questions' | 'with_answers';

type ChapterGroup = {
  chapterKey: string;
  chapterLabel: string;
  items: Array<{ row: SavedShortcut; displayNumber: number }>;
};

type BookGroup = {
  bookKey: string;
  bookName: string;
  chapters: ChapterGroup[];
};

function isGenericTitle(title?: string) {
  const t = title?.trim().toLowerCase() ?? '';
  return !t || t === 'explanation' || t === 'explanations' || t === 'answer' || t === 'answers';
}

function marathonStem(detail: QuestionDetail) {
  const bn = detail.body_bn?.trim() ?? '';
  const en = detail.body_en?.trim() ?? '';
  return bn || en;
}

function bookKeyOf(row: SavedShortcut) {
  return row.book_id?.trim() || row.subtitle?.split('·')[0]?.trim() || '__other__';
}

function bookNameOf(row: SavedShortcut) {
  const fromSub = row.subtitle?.split('·')[0]?.trim();
  return fromSub || (row.book_id ? 'Book' : 'Other');
}

function chapterKeyOf(row: SavedShortcut) {
  return row.chapter_id?.trim() || row.subtitle?.split('·')[1]?.trim() || '__chapter__';
}

function chapterLabelOf(row: SavedShortcut) {
  const fromSub = row.subtitle?.split('·')[1]?.trim();
  return fromSub || 'Questions';
}

/** Group by book → chapter, assign display numbers 1..n in order. */
function groupMarathonByBook(rows: SavedShortcut[]): BookGroup[] {
  const sorted = [...rows].sort((a, b) => {
    const bookCmp = bookNameOf(a).localeCompare(bookNameOf(b));
    if (bookCmp !== 0) return bookCmp;
    return chapterLabelOf(a).localeCompare(chapterLabelOf(b));
  });

  const bookMap = new Map<string, BookGroup>();
  let n = 1;

  for (const row of sorted) {
    const bKey = bookKeyOf(row);
    const bName = bookNameOf(row);
    let book = bookMap.get(bKey);
    if (!book) {
      book = { bookKey: bKey, bookName: bName, chapters: [] };
      bookMap.set(bKey, book);
    }

    const cKey = chapterKeyOf(row);
    const cLabel = chapterLabelOf(row);
    let chapter = book.chapters.find((c) => c.chapterKey === cKey);
    if (!chapter) {
      chapter = { chapterKey: cKey, chapterLabel: cLabel, items: [] };
      book.chapters.push(chapter);
    }
    chapter.items.push({ row, displayNumber: n });
    n += 1;
  }

  return [...bookMap.values()];
}

function AnswerBlocks({ itemId, sections }: { itemId: string; sections: ExplanationSection[] }) {
  return (
    <View style={styles.answerWrap}>
      {sections.map((sec, idx) => {
        const title = sec.title?.trim();
        const showTitle = title && !isGenericTitle(title);
        return (
          <View key={`${itemId}-ans-${idx}`} style={styles.answerRow}>
            <View style={styles.answerSquare} />
            <View style={styles.answerContent}>
              {showTitle ? <Text style={styles.answerTitle}>{title}</Text> : null}
              {sec.content?.trim() ? (
                <BookRichText html={sec.content} style={styles.answerText} />
              ) : null}
              {sec.details?.trim() ? (
                <BookRichText html={sec.details} style={styles.answerText} />
              ) : null}
              {sec.note?.trim() ? (
                <BookRichText html={sec.note} style={styles.answerNote} />
              ) : null}
              {(sec.subsections ?? []).map((sub, si) => (
                <View key={`${itemId}-sub-${idx}-${si}`} style={styles.subBlock}>
                  {sub.subtitle?.trim() && !isGenericTitle(sub.subtitle) ? (
                    <Text style={styles.subTitle}>{sub.subtitle.trim()}</Text>
                  ) : null}
                  {sub.details?.trim() ? (
                    <BookRichText html={sub.details} style={styles.answerText} />
                  ) : null}
                  {sub.note?.trim() ? (
                    <BookRichText html={sub.note} style={styles.answerNote} />
                  ) : null}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function SavedMarathonScreen() {
  const { items: saved } = useSavedShortcuts();
  const marathonSaved = useMemo(() => saved.filter((row) => row.kind === 'marathon'), [saved]);

  const [details, setDetails] = useState<Map<string, QuestionDetail>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<ShowMode>('questions');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [selectedBookKey, setSelectedBookKey] = useState<string | null>(null);
  const [bookMenuOpen, setBookMenuOpen] = useState(false);
  const [evalMap, setEvalMap] = useState<Map<string, QuestionEvalBrief>>(new Map());

  useEffect(() => {
    const ids = marathonSaved.map((row) => row.id);
    if (ids.length === 0) {
      setEvalMap(new Map());
      return;
    }
    let cancelled = false;
    fetchQuestionEvaluationsBatch(ids)
      .then((rows) => {
        if (cancelled) return;
        const map = new Map<string, QuestionEvalBrief>();
        for (const row of rows) {
          if (row.progress_index > 0 || row.self_rating || row.is_correct !== undefined) {
            map.set(row.question_id, row);
          }
        }
        setEvalMap(map);
      })
      .catch(() => {
        if (!cancelled) setEvalMap(new Map());
      });
    return () => {
      cancelled = true;
    };
  }, [marathonSaved]);

  const allGroups = useMemo(() => groupMarathonByBook(marathonSaved), [marathonSaved]);
  const bookOptions = useMemo(
    () =>
      allGroups.map((g) => ({
        id: g.bookKey,
        name: g.bookName,
        count: g.chapters.reduce((sum, c) => sum + c.items.length, 0),
      })),
    [allGroups],
  );
  const visibleGroups = useMemo(
    () => (selectedBookKey ? allGroups.filter((g) => g.bookKey === selectedBookKey) : allGroups),
    [allGroups, selectedBookKey],
  );
  const selectedBookName = selectedBookKey
    ? bookOptions.find((b) => b.id === selectedBookKey)?.name
    : null;

  /** Renumber 1..n for the currently visible books only. */
  const numberedGroups = useMemo(() => {
    let n = 1;
    return visibleGroups.map((book) => ({
      ...book,
      chapters: book.chapters.map((ch) => ({
        ...ch,
        items: ch.items.map(({ row }) => {
          const item = { row, displayNumber: n };
          n += 1;
          return item;
        }),
      })),
    }));
  }, [visibleGroups]);

  const loadDetails = useCallback(async () => {
    setError('');
    if (marathonSaved.length === 0) {
      setDetails(new Map());
      return;
    }
    const map = new Map<string, QuestionDetail>();
    await Promise.all(
      marathonSaved.map(async (row) => {
        try {
          const detail = await fetchQuestionDetail(row.id);
          map.set(row.id, detail);
        } catch {
          // keep placeholder from saved title
        }
      }),
    );
    setDetails(map);
  }, [marathonSaved]);

  useEffect(() => {
    setLoading(true);
    void loadDetails().finally(() => setLoading(false));
  }, [loadDetails]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadDetails();
    setRefreshing(false);
  }, [loadDetails]);

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (loading && marathonSaved.length > 0) {
    return <BookLoading />;
  }

  if (error) {
    return <BookError message={error} />;
  }

  if (marathonSaved.length === 0) {
    return (
      <BookEmpty
        title="No saved marathon questions"
        subtitle="Tap the bookmark on an MCQ in Question Bank or Marathon Review to add it here."
      />
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, mode === 'questions' && styles.toggleBtnActive]}
            onPress={() => setMode('questions')}
          >
            <Text style={[styles.toggleText, mode === 'questions' && styles.toggleTextActive]}>
              Questions
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, mode === 'with_answers' && styles.toggleBtnActive]}
            onPress={() => setMode('with_answers')}
          >
            <Text style={[styles.toggleText, mode === 'with_answers' && styles.toggleTextActive]}>
              With answers
            </Text>
          </Pressable>
        </View>
        <Pressable
          style={styles.menuBtn}
          onPress={() => setBookMenuOpen((v) => !v)}
          accessibilityLabel="Filter by book"
        >
          <Ionicons name="ellipsis-vertical" size={18} color={colors.primary} />
        </Pressable>
      </View>

      {bookMenuOpen ? (
        <View style={styles.bookMenu}>
          <Pressable
            style={[styles.bookMenuItem, !selectedBookKey && styles.bookMenuItemActive]}
            onPress={() => {
              setSelectedBookKey(null);
              setBookMenuOpen(false);
            }}
          >
            <Text style={[styles.bookMenuItemText, !selectedBookKey && styles.bookMenuItemTextActive]}>
              All books ({marathonSaved.length})
            </Text>
          </Pressable>
          {bookOptions.map((book) => {
            const active = selectedBookKey === book.id;
            return (
              <Pressable
                key={book.id}
                style={[styles.bookMenuItem, active && styles.bookMenuItemActive]}
                onPress={() => {
                  setSelectedBookKey(book.id);
                  setBookMenuOpen(false);
                }}
              >
                <Text style={[styles.bookMenuItemText, active && styles.bookMenuItemTextActive]} numberOfLines={1}>
                  {book.name} ({book.count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {selectedBookName ? (
        <View style={styles.filterChipRow}>
          <View style={styles.filterChip}>
            <Text style={styles.filterChipText} numberOfLines={1}>
              {selectedBookName}
            </Text>
            <Pressable onPress={() => setSelectedBookKey(null)} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={colors.primary} />
            </Pressable>
          </View>
        </View>
      ) : null}

      {mode === 'questions' ? (
        <Text style={styles.hint}>Tap or press & hold a question to show the answer</Text>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {numberedGroups.map((book) => (
          <View key={book.bookKey} style={styles.bookBlock}>
            <Text style={styles.bookTitle}>{book.bookName}</Text>
            {book.chapters.map((chapter) => (
              <View key={chapter.chapterKey} style={styles.chapterBlock}>
                <Text style={styles.chapterTitle}>{chapter.chapterLabel}</Text>
                {chapter.items.map(({ row, displayNumber }) => {
                  const detail = details.get(row.id);
                  const text = detail ? marathonStem(detail) : row.title;
                  const sections = detail?.explanation_sections ?? [];
                  const revealed = revealedIds.has(row.id);
                  const showAnswer = mode === 'with_answers' || revealed;
                  const questionsOnly = mode === 'questions';

                  return (
                    <SwipeToRemove
                      key={row.id}
                      confirmTitle="Remove saved marathon question?"
                      confirmMessage="Remove this question from Saved on this device?"
                      onConfirmRemove={() => removeSavedShortcut(row.id, 'marathon')}
                    >
                      <Pressable
                        style={({ pressed }) => [
                          styles.questionRow,
                          pressed && questionsOnly && styles.questionRowPressed,
                          questionsOnly && revealed && styles.questionRowRevealed,
                        ]}
                        onPress={() => {
                          if (questionsOnly) toggleReveal(row.id);
                        }}
                        onLongPress={questionsOnly ? () => toggleReveal(row.id) : undefined}
                        delayLongPress={350}
                      >
                        <Text style={styles.number}>{displayNumber}.</Text>
                        <View style={styles.ratingWrap}>
                          <RatingIndicator evaluation={evalMap.get(row.id)} />
                        </View>
                        <View style={styles.questionBody}>
                          {detail ? (
                            <BookRichText html={text} style={styles.questionText} />
                          ) : (
                            <Text style={styles.questionTextPlain}>{stripHtml(text)}</Text>
                          )}
                          {showAnswer ? (
                            !detail ? (
                              <View style={styles.loadingAnswer}>
                                <ActivityIndicator size="small" color={colors.primary} />
                              </View>
                            ) : sections.length > 0 ? (
                              <AnswerBlocks itemId={row.id} sections={sections} />
                            ) : (
                              <View style={styles.answerMissingRow}>
                                <View style={styles.answerSquare} />
                                <Text style={styles.answerMissing}>Not set</Text>
                              </View>
                            )
                          ) : null}
                        </View>
                      </Pressable>
                    </SwipeToRemove>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  toggleRow: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 4,
    gap: 4,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.white,
  },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bookMenu: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  bookMenuItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  bookMenuItemActive: {
    backgroundColor: '#e8f2fa',
  },
  bookMenuItemText: {
    fontSize: 14,
    color: colors.text,
  },
  bookMenuItemTextActive: {
    color: colors.primary,
    fontWeight: '700',
  },
  filterChipRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  filterChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#e8f2fa',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    maxWidth: '100%',
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
    maxWidth: 220,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  list: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  bookBlock: {
    gap: spacing.md,
  },
  bookTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primary,
  },
  chapterBlock: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chapterTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  questionRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  questionRowPressed: {
    opacity: 0.92,
  },
  questionRowRevealed: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  number: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    minWidth: 28,
  },
  ratingWrap: {
    paddingTop: 3,
  },
  questionBody: {
    flex: 1,
    gap: 6,
  },
  questionText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  questionTextPlain: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  loadingAnswer: {
    paddingVertical: 8,
  },
  answerWrap: {
    gap: 8,
    marginTop: 4,
  },
  answerRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  answerMissingRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginTop: 4,
  },
  answerSquare: {
    width: 10,
    height: 10,
    marginTop: 5,
    backgroundColor: colors.primary,
    borderRadius: 2,
  },
  answerContent: {
    flex: 1,
    gap: 4,
  },
  answerTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  answerText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  answerNote: {
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  answerMissing: {
    fontSize: 13,
    color: colors.textMuted,
  },
  subBlock: {
    marginTop: 4,
    gap: 2,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
