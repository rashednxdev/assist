import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ExplanationSection, KnowAreaSummary, KnowQuestionItem } from '@ibas/shared-types';
import { BookRichText } from '@/components/books/BookRichText';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { cleanBookLabel, stripHtml } from '@/lib/book-display';
import { fetchArchiveOverview, fetchKnowQuestions } from '@/lib/policy-api';
import { colors, spacing } from '@/theme';

type ShowMode = 'questions' | 'with_answers';

type Group = { key: string; book: string; chapter: string; items: KnowQuestionItem[] };

function questionText(item: KnowQuestionItem) {
  return item.body_bn?.trim() || item.body_en.trim();
}

function isGenericTitle(title?: string) {
  const t = title?.trim().toLowerCase() ?? '';
  return !t || t === 'explanation' || t === 'explanations' || t === 'answer' || t === 'answers';
}

function AnswerBlocks({ itemId, sections }: { itemId: string; sections: ExplanationSection[] }) {
  if (sections.length === 0) {
    return (
      <View style={styles.answerRow}>
        <View style={styles.answerSquare} />
        <Text style={styles.answerMissing}>Not set</Text>
      </View>
    );
  }
  return (
    <View style={styles.answerWrap}>
      {sections.map((sec, idx) => (
        <View key={`${itemId}-ans-${idx}`} style={styles.answerRow}>
          <View style={styles.answerSquare} />
          <View style={styles.answerContent}>
            {!isGenericTitle(sec.title) ? <Text style={styles.answerTitle}>{sec.title?.trim()}</Text> : null}
            {sec.details?.trim() ? <BookRichText html={sec.details} style={styles.answerText} /> : null}
            {sec.note?.trim() ? <BookRichText html={sec.note} style={styles.answerNote} /> : null}
            {(sec.subsections ?? []).map((sub, si) => (
              <View key={`${itemId}-sub-${idx}-${si}`} style={styles.subBlock}>
                {!isGenericTitle(sub.subtitle) ? <Text style={styles.subTitle}>{sub.subtitle?.trim()}</Text> : null}
                {sub.details?.trim() ? <BookRichText html={sub.details} style={styles.answerText} /> : null}
                {sub.note?.trim() ? <BookRichText html={sub.note} style={styles.answerNote} /> : null}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

export default function KnowQuestionsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ area?: string }>();
  const [areas, setAreas] = useState<KnowAreaSummary[]>([]);
  const [area, setArea] = useState(params.area ?? '');
  const [items, setItems] = useState<KnowQuestionItem[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [mode, setMode] = useState<ShowMode>('questions');
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchArchiveOverview()
      .then((o) => {
        setAreas(o.areas);
        setArea((cur) => cur || o.areas[0]?.code || '');
      })
      .catch(() => setAreas([]));
  }, []);

  const load = useCallback(async () => {
    if (!area) return;
    try {
      setItems(await fetchKnowQuestions(area));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load questions');
      setItems((cur) => cur ?? []);
    }
  }, [area]);

  useEffect(() => {
    setItems(null);
    setRevealed(new Set());
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const groups = useMemo(() => {
    const term = search.trim().toLowerCase();
    const out: Group[] = [];
    for (const it of items ?? []) {
      if (term && !stripHtml(`${it.body_bn ?? ''} ${it.body_en}`).toLowerCase().includes(term)) continue;
      const key = `${it.book_id ?? '-'}:${it.chapter_id ?? '-'}`;
      let g = out.find((x) => x.key === key);
      if (!g) {
        g = { key, book: it.book_name ?? 'Other questions', chapter: cleanBookLabel(it.chapter_label) || '', items: [] };
        out.push(g);
      }
      g.items.push(it);
    }
    return out;
  }, [items, search]);

  function toggle(id: string) {
    setRevealed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const areaInfo = areas.find((a) => a.code === area);
  const shown = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <View style={styles.root}>
      {areas.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipBar}>
          {areas.map((a) => {
            const active = a.code === area;
            return (
              <Pressable
                key={a.code}
                onPress={() => setArea(a.code)}
                style={[styles.chip, { borderColor: a.color }, active && { backgroundColor: a.color }]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                  {a.name_en} · {a.question_count}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.toolbar}>
        <View style={styles.toggleRow}>
          {(['questions', 'with_answers'] as const).map((m) => (
            <Pressable
              key={m}
              style={[styles.toggleBtn, mode === m && styles.toggleBtnActive]}
              onPress={() => {
                setMode(m);
                if (m === 'with_answers') setRevealed(new Set());
              }}
            >
              <Text style={[styles.toggleText, mode === m && styles.toggleTextActive]}>
                {m === 'questions' ? 'Questions' : 'With answers'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={[styles.iconBtn, searchOpen && styles.iconBtnActive]}
          onPress={() => {
            setSearchOpen((v) => !v);
            if (searchOpen) setSearch('');
          }}
          hitSlop={8}
          accessibilityLabel="Search"
        >
          <Ionicons name={searchOpen ? 'close' : 'search'} size={20} color={searchOpen ? colors.white : colors.primary} />
        </Pressable>
      </View>

      {searchOpen ? (
        <View style={styles.searchBar}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search questions…"
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            autoFocus
          />
        </View>
      ) : null}

      <View style={styles.infoRow}>
        {mode === 'questions' ? <Text style={styles.hint}>Tap a question to show the answer and related circulars</Text> : null}
        <Text style={styles.meta}>
          {areaInfo ? `${areaInfo.name_en} · ` : ''}
          {search.trim() ? `${shown} of ${items?.length ?? 0}` : `${items?.length ?? 0}`} questions
        </Text>
      </View>

      {!area && areas.length === 0 && items === null ? (
        <BookEmpty title="No questions yet" subtitle="The admin has not added any questions to the archive." />
      ) : items === null ? (
        <BookLoading />
      ) : error && items.length === 0 ? (
        <BookError message={error} />
      ) : groups.length === 0 ? (
        <BookEmpty title={search.trim() ? 'No matching questions' : 'No questions in this area yet'} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        >
          {groups.map((g) => (
            <View key={g.key} style={styles.groupBlock}>
              <Text style={styles.bookTitle}>{g.book}</Text>
              <View style={styles.chapterBlock}>
                {g.chapter ? <Text style={styles.chapterTitle}>{g.chapter}</Text> : null}
                {g.items.map((item) => {
                  const open = mode === 'with_answers' || revealed.has(item.id);
                  return (
                    <Pressable
                      key={item.link_id}
                      style={({ pressed }) => [
                        styles.questionRow,
                        pressed && mode === 'questions' && styles.pressed,
                        mode === 'questions' && revealed.has(item.id) && styles.questionRowRevealed,
                      ]}
                      onPress={() => (mode === 'questions' ? toggle(item.id) : undefined)}
                    >
                      <Text style={styles.number}>{item.number}.</Text>
                      <View style={styles.questionBody}>
                        <BookRichText html={questionText(item)} style={styles.questionText} />
                        {!open && item.circulars.length > 0 ? (
                          <View style={styles.circHint}>
                            <Ionicons name="document-text-outline" size={13} color="#4338ca" />
                            <Text style={styles.circHintText}>
                              {item.circulars.length} related circular{item.circulars.length === 1 ? '' : 's'}
                            </Text>
                          </View>
                        ) : null}
                        {open ? (
                          <>
                            <AnswerBlocks itemId={item.id} sections={item.explanation_sections} />
                            {item.circulars.length > 0 ? (
                              <View style={styles.circBox}>
                                <Text style={styles.circBoxTitle}>RELATED CIRCULARS</Text>
                                {item.circulars.map((c) => (
                                  <Pressable
                                    key={c.id}
                                    onPress={() => router.push(`/(app)/circulars/${c.id}` as Href)}
                                    style={({ pressed }) => [styles.circRow, pressed && styles.pressed]}
                                  >
                                    <Ionicons name="document-text" size={16} color="#4338ca" />
                                    <View style={styles.flex}>
                                      <Text style={styles.circTitle} numberOfLines={2}>
                                        {c.title_bn?.trim() || c.title}
                                      </Text>
                                      <Text style={styles.circMeta}>
                                        {c.circular_no} · {c.issue_date}
                                      </Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                                  </Pressable>
                                ))}
                              </View>
                            ) : null}
                          </>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
          {refreshing ? <ActivityIndicator color={colors.primary} /> : null}
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
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  chipBar: {
    flexGrow: 0,
  },
  chips: {
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  chip: {
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  chipTextActive: {
    color: colors.white,
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
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  searchBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchInput: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  infoRow: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    gap: 4,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  list: {
    padding: spacing.md,
    gap: spacing.lg,
    paddingBottom: spacing.xl,
  },
  groupBlock: {
    gap: spacing.sm,
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
  circHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  circHintText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4338ca',
  },
  answerWrap: {
    marginTop: 8,
    gap: 8,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
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
  circBox: {
    marginTop: 10,
    gap: 6,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    padding: spacing.sm,
  },
  circBoxTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#3730a3',
  },
  circRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 8,
    backgroundColor: colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  circTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  circMeta: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
