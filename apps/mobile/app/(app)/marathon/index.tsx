import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { cleanBookLabel } from '@/lib/book-display';
import { fetchMarathonReview } from '@/lib/questions-api';
import type { MarathonExplanationSection, MarathonReviewItem } from '@/types/marathon';
import { colors, spacing } from '@/theme';

type ShowMode = 'questions' | 'with_answers';

type ChapterGroup = {
  chapter_id: string;
  chapter_label: string;
  items: MarathonReviewItem[];
};

type BookGroup = {
  book_id: string;
  book_name: string;
  chapters: ChapterGroup[];
};

/** Prefer Bengali stem; fall back to English if BN is empty. */
function marathonQuestionText(bodyEn?: string | null, bodyBn?: string | null) {
  const bn = bodyBn?.trim() ?? '';
  const en = bodyEn?.trim() ?? '';
  return bn || en;
}

function isGenericTitle(title?: string) {
  const t = title?.trim().toLowerCase() ?? '';
  return !t || t === 'explanation' || t === 'explanations' || t === 'answer' || t === 'answers';
}

function groupByBookChapter(items: MarathonReviewItem[]): BookGroup[] {
  const bookMap = new Map<string, BookGroup>();

  for (const item of items) {
    let book = bookMap.get(item.book_id);
    if (!book) {
      book = { book_id: item.book_id, book_name: item.book_name, chapters: [] };
      bookMap.set(item.book_id, book);
    }
    let chapter = book.chapters.find((c) => c.chapter_id === item.chapter_id);
    if (!chapter) {
      const no = cleanBookLabel(item.chapter_number);
      const name = cleanBookLabel(item.chapter_name) || item.chapter_name;
      chapter = {
        chapter_id: item.chapter_id,
        chapter_label: no ? `${no}: ${name}` : name,
        items: [],
      };
      book.chapters.push(chapter);
    }
    chapter.items.push(item);
  }

  return [...bookMap.values()];
}

function AnswerBlocks({
  itemId,
  sections,
}: {
  itemId: string;
  sections: MarathonExplanationSection[];
}) {
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
              {sec.details?.trim() ? (
                <Text style={styles.answerText}>{sec.details.trim()}</Text>
              ) : null}
              {sec.note?.trim() ? <Text style={styles.answerNote}>{sec.note.trim()}</Text> : null}
              {(sec.subsections ?? []).map((sub, si) => (
                <View key={`${itemId}-sub-${idx}-${si}`} style={styles.subBlock}>
                  {sub.subtitle?.trim() && !isGenericTitle(sub.subtitle) ? (
                    <Text style={styles.subTitle}>{sub.subtitle.trim()}</Text>
                  ) : null}
                  {sub.details?.trim() ? (
                    <Text style={styles.answerText}>{sub.details.trim()}</Text>
                  ) : null}
                  {sub.note?.trim() ? <Text style={styles.answerNote}>{sub.note.trim()}</Text> : null}
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function MarathonReviewScreen() {
  const [items, setItems] = useState<MarathonReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [mode, setMode] = useState<ShowMode>('questions');
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

  const load = useCallback(async (q?: string) => {
    setError('');
    try {
      const data = await fetchMarathonReview({ q });
      setItems(data);
      setRevealedIds(new Set());
    } catch (err) {
      setItems([]);
      setError(err instanceof Error ? err.message : 'Failed to load marathon review');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load(searchQuery).finally(() => setLoading(false));
  }, [load, searchQuery]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load(searchQuery);
    } finally {
      setRefreshing(false);
    }
  }, [load, searchQuery]);

  const groups = useMemo(() => groupByBookChapter(items), [items]);

  function submitSearch() {
    setSearchQuery(searchDraft.trim());
  }

  function clearSearch() {
    setSearchDraft('');
    setSearchQuery('');
    setSearchOpen(false);
  }

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function setShowMode(next: ShowMode) {
    setMode(next);
    if (next === 'with_answers') setRevealedIds(new Set());
  }

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.toggleRow}>
          <Pressable
            style={[styles.toggleBtn, mode === 'questions' && styles.toggleBtnActive]}
            onPress={() => setShowMode('questions')}
          >
            <Text style={[styles.toggleText, mode === 'questions' && styles.toggleTextActive]}>
              Questions
            </Text>
          </Pressable>
          <Pressable
            style={[styles.toggleBtn, mode === 'with_answers' && styles.toggleBtnActive]}
            onPress={() => setShowMode('with_answers')}
          >
            <Text style={[styles.toggleText, mode === 'with_answers' && styles.toggleTextActive]}>
              With answers
            </Text>
          </Pressable>
        </View>

        <Pressable
          style={[styles.searchIconBtn, searchOpen && styles.searchIconBtnActive]}
          onPress={() => setSearchOpen((v) => !v)}
          hitSlop={8}
        >
          <Ionicons name="search" size={20} color={searchOpen ? colors.white : colors.primary} />
        </Pressable>
      </View>

      {mode === 'questions' ? (
        <Text style={styles.hint}>Tap or press & hold a question to show the answer</Text>
      ) : null}

      {searchOpen ? (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search MCQ text…"
            placeholderTextColor={colors.textMuted}
            value={searchDraft}
            onChangeText={setSearchDraft}
            onSubmitEditing={submitSearch}
            returnKeyType="search"
            autoFocus
          />
          <Pressable style={styles.searchAction} onPress={submitSearch}>
            <Text style={styles.searchActionText}>Search</Text>
          </Pressable>
          {searchQuery ? (
            <Pressable style={styles.clearAction} onPress={clearSearch}>
              <Text style={styles.clearActionText}>Clear</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <Text style={styles.meta}>
        {items.length} Questions
        {searchQuery ? ` · “${searchQuery}”` : ''}
        {mode === 'with_answers'
          ? ' · answers shown'
          : revealedIds.size > 0
            ? ` · ${revealedIds.size} revealed`
            : ''}
      </Text>

      {loading ? (
        <BookLoading />
      ) : error ? (
        <BookError message={error} />
      ) : items.length === 0 ? (
        <BookEmpty
          title="No MCQ questions found"
          subtitle="Published MCQs linked to books and chapters will appear here."
        />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          {groups.map((book) => (
            <View key={book.book_id} style={styles.bookBlock}>
              <Text style={styles.bookTitle}>{book.book_name}</Text>
              {book.chapters.map((chapter) => (
                <View key={chapter.chapter_id} style={styles.chapterBlock}>
                  <Text style={styles.chapterTitle}>{chapter.chapter_label}</Text>
                  {chapter.items.map((item) => {
                    const text = marathonQuestionText(item.body_en, item.body_bn);
                    const sections = item.explanation_sections ?? [];
                    const revealed = revealedIds.has(item.id);
                    const showAnswer = mode === 'with_answers' || revealed;
                    const questionsOnly = mode === 'questions';

                    return (
                      <Pressable
                        key={item.id}
                        style={({ pressed }) => [
                          styles.questionRow,
                          pressed && questionsOnly && styles.questionRowPressed,
                          questionsOnly && revealed && styles.questionRowRevealed,
                        ]}
                        onPress={questionsOnly ? () => toggleReveal(item.id) : undefined}
                        onLongPress={questionsOnly ? () => toggleReveal(item.id) : undefined}
                        delayLongPress={350}
                      >
                        <Text style={styles.number}>{item.number}.</Text>
                        <View style={styles.questionBody}>
                          <Text style={styles.questionText}>{text}</Text>
                          {showAnswer ? (
                            sections.length > 0 ? (
                              <AnswerBlocks itemId={item.id} sections={sections} />
                            ) : (
                              <View style={styles.answerRow}>
                                <View style={styles.answerSquare} />
                                <Text style={styles.answerMissing}>Not set</Text>
                              </View>
                            )
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ))}
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
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 9,
  },
  toggleBtnActive: {
    backgroundColor: colors.primary,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.white,
  },
  hint: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  searchIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIconBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  searchAction: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.primary,
  },
  searchActionText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  clearAction: {
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  clearActionText: {
    color: colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },
  meta: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    fontSize: 12,
    color: colors.textMuted,
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  questionRowPressed: {
    opacity: 0.85,
  },
  questionRowRevealed: {
    backgroundColor: '#f7fbfe',
    marginHorizontal: -4,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  number: {
    width: 28,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    paddingTop: 1,
  },
  questionBody: {
    flex: 1,
    gap: 4,
  },
  questionText: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    fontWeight: '500',
  },
  answerWrap: {
    marginTop: 8,
    gap: 8,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
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
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
  answerNote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  answerMissing: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
    paddingTop: 2,
  },
  subBlock: {
    marginTop: 4,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    gap: 2,
  },
  subTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
});
