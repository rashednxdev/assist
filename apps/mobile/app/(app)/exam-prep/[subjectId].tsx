import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type {
  PreparationChapterRow,
  PreparationQuizQuestion,
  PreparationSubjectWorkspace,
  PreparationWrittenRow,
} from '@ibas/shared-types';
import { ChapterMcqRunner } from '@/components/exam-prep/ChapterMcqRunner';
import {
  fetchChapterQuiz,
  fetchExamPrepSubjectWorkspace,
} from '@/lib/exam-prep-api';
import { accessDate, durationLabel } from '@/lib/billing-api';
import { toBanglaDigits } from '@/lib/bangla-format';
import { colors, spacing } from '@/theme';

type WorkspaceTab = 'overview' | 'books' | 'written' | 'mcq' | 'papers' | 'live';

const QUESTION_TYPE_LABELS: Record<string, string> = {
  DESCRIPTIVE: 'বর্ণনামূলক',
  SHORT_NOTE: 'টীকা',
  DIFFERENCES: 'পার্থক্য',
  TRANSLATION: 'অনুবাদ',
  SUMMARY: 'সারাংশ',
  DRAFTING: 'খসড়া লিখন',
  CALCULATION: 'গাণিতিক',
};

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function moneyBn(price: number): string {
  return price === 0 ? 'ফ্রি' : `৳${price.toLocaleString('bn-BD')}`;
}

function durationBn(days: number): string {
  if (days % 365 === 0) return `${bn(days / 365)} বছর অ্যাক্সেস`;
  if (days % 30 === 0) return `${bn(days / 30)} মাস অ্যাক্সেস`;
  return `${bn(days)} দিন অ্যাক্সেস (${durationLabel(days)})`;
}

function formatClassDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('bn-BD', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function SubjectWorkspaceScreen() {
  const router = useRouter();
  const { subjectId } = useLocalSearchParams<{ subjectId: string }>();
  const id = Array.isArray(subjectId) ? subjectId[0] : subjectId;

  const [tab, setTab] = useState<WorkspaceTab>('overview');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [bookFilter, setBookFilter] = useState('');
  const [bankSearch, setBankSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [expandedPreviewBook, setExpandedPreviewBook] = useState<string | null>(null);
  const [lockedPrompt, setLockedPrompt] = useState(false);

  const [data, setData] = useState<PreparationSubjectWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [quizSession, setQuizSession] = useState<{
    chapter: PreparationChapterRow;
    wrongOnly: boolean;
    questions: PreparationQuizQuestion[];
  } | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);

  const loadWorkspace = useCallback(
    async (silent = false) => {
      if (!id) return;
      if (!silent) setLoading(true);
      setError('');
      try {
        const res = await fetchExamPrepSubjectWorkspace(id);
        setData(res);
        if (res.preview_books[0] && !expandedPreviewBook) {
          setExpandedPreviewBook(res.preview_books[0].id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'লোড করা যায়নি');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [id, expandedPreviewBook],
  );

  useFocusEffect(
    useCallback(() => {
      void loadWorkspace();
    }, [loadWorkspace]),
  );

  async function launchChapterQuiz(chapter: PreparationChapterRow, wrongOnly: boolean) {
    if (!id) return;
    setQuizLoading(true);
    try {
      const questions = await fetchChapterQuiz(id, chapter.id, wrongOnly);
      setTab('mcq');
      setQuizSession({ chapter, wrongOnly, questions });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'প্রশ্ন লোড করা যায়নি');
    } finally {
      setQuizLoading(false);
    }
  }

  const filteredWritten = useMemo(() => {
    if (!data) return [];
    const q = bankSearch.trim().toLowerCase();
    return data.written_questions.filter((row) => {
      if (readFilter === 'read' && row.read_count === 0) return false;
      if (readFilter === 'unread' && row.read_count > 0) return false;
      if (bookFilter && (row.book_id ?? '__none__') !== bookFilter) return false;
      if (typeFilter && row.question_type_code !== typeFilter) return false;
      if (q && !row.title.toLowerCase().includes(q) && !(row.chapter_name ?? '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [data, readFilter, bookFilter, typeFilter, bankSearch]);

  const writtenGroupedByBook = useMemo(() => {
    const groups = new Map<string, { key: string; bookName: string; items: PreparationWrittenRow[] }>();
    for (const item of filteredWritten) {
      const key = item.book_id ?? '__none__';
      const bookName = item.book_name ?? 'অন্যান্য সংযুক্ত লিখিত প্রশ্ন';
      const g = groups.get(key);
      if (g) g.items.push(item);
      else groups.set(key, { key, bookName, items: [item] });
    }
    return [...groups.values()];
  }, [filteredWritten]);

  const writtenTypes = useMemo(() => {
    const codes = new Set((data?.written_questions ?? []).map((q) => q.question_type_code));
    return [...codes];
  }, [data]);

  const chaptersGroupedByBook = useMemo(() => {
    const groups = new Map<string, { key: string; bookName: string; chapters: PreparationChapterRow[] }>();
    for (const ch of data?.chapters ?? []) {
      const key = ch.book_id ?? '__none__';
      const bookName = ch.book_name ?? 'সাধারণ ও সংযুক্ত অধ্যায়';
      const g = groups.get(key);
      if (g) g.chapters.push(ch);
      else groups.set(key, { key, bookName, chapters: [ch] });
    }
    return [...groups.values()];
  }, [data]);

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#1566b8" />
      </View>
    );
  }

  if (error && !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => void loadWorkspace()}>
          <Text style={styles.primaryBtnText}>আবার চেষ্টা</Text>
        </Pressable>
      </View>
    );
  }

  if (!data) return null;

  const title = data.name_bn?.trim() || data.name;
  const examPackages = data.packages.filter((p) => p.kind === 'exam_prep');
  const livePackages = data.packages.filter((p) => p.kind === 'live');
  const primaryPkg = examPackages
    .slice()
    .sort((a, b) => Number(Boolean(a.whole_part)) - Number(Boolean(b.whole_part)) || a.price - b.price)[0];
  const upcomingClasses = data.classes.filter((c) => !c.past);
  const pastClasses = data.classes.filter((c) => c.past);
  const nextUpcoming = upcomingClasses[0] ?? null;
  const mcqAccuracy = data.mcq_touched > 0 ? Math.round((data.mcq_correct / data.mcq_touched) * 100) : 0;

  const TABS: Array<{ id: WorkspaceTab; label: string; count?: number }> = [
    { id: 'overview', label: 'সারসংক্ষেপ' },
    { id: 'books', label: 'বই', count: data.books },
    { id: 'written', label: 'লিখিত', count: data.written },
    { id: 'mcq', label: 'MCQ', count: data.mcq },
    { id: 'papers', label: 'বিগত', count: data.papers },
    { id: 'live', label: 'লাইভ', count: upcomingClasses.length + data.past_classes },
  ];

  function openTab(next: WorkspaceTab) {
    setQuizSession(null);
    setTab(next);
  }

  /* Locked / not enrolled */
  if (data.locked) {
    return (
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              try {
                await loadWorkspace(true);
              } finally {
                setRefreshing(false);
              }
            }}
          />
        }
      >
        <View style={styles.lockedHero}>
          <View style={styles.chipRow}>
            <Text style={styles.heroChip}>পরীক্ষা প্রস্তুতি</Text>
            <Text style={styles.heroChipMuted}>{data.part_label}</Text>
          </View>
          <Text style={styles.lockedTitle}>{title}</Text>
          {data.name_bn?.trim() ? <Text style={styles.lockedEn}>{data.name}</Text> : null}
          <Text style={styles.lockedDesc}>
            এই বিষয়ের সকল বই ও বিধি, অধ্যায়ভিত্তিক লিখিত প্রশ্নব্যাংক, MCQ স্ব-মূল্যায়ন, বিগত বছরের প্রশ্ন সেট এবং
            লাইভ ক্লাস এক জায়গায় সাজানো।
          </Text>
          <View style={styles.chipRow}>
            <Text style={styles.statChip}>{bn(data.books)}টি বই</Text>
            <Text style={styles.statChip}>{bn(data.written)}টি লিখিত</Text>
            <Text style={styles.statChip}>{bn(data.mcq)}টি MCQ</Text>
            <Text style={styles.statChip}>{bn(data.papers)}টি বিগত</Text>
          </View>
        </View>

        {lockedPrompt ? (
          <View style={styles.lockPrompt}>
            <Ionicons name="lock-closed" size={16} color="#b45309" />
            <Text style={styles.lockPromptText}>মূল বই, প্রশ্ন ও MCQ খুলতে এই বিষয়ের প্যাকেজে এনরোল করতে হবে।</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>বিষয়ভিত্তিক রিসোর্স সারাংশ</Text>
          {data.preview_books.length === 0 ? (
            <Text style={styles.muted}>এই বিষয়ে এখনো প্রকাশিত বই যুক্ত হয়নি।</Text>
          ) : (
            data.preview_books.map((book) => {
              const open = expandedPreviewBook === book.id;
              return (
                <View key={book.id} style={styles.previewBook}>
                  <Pressable
                    style={styles.previewHead}
                    onPress={() => {
                      setExpandedPreviewBook(open ? null : book.id);
                      setLockedPrompt(true);
                    }}
                  >
                    <View style={styles.flex1}>
                      <Text style={styles.previewName}>{book.name_bn?.trim() || book.name}</Text>
                      <Text style={styles.muted}>
                        {bn(book.chapter_count)}টি অধ্যায়
                      </Text>
                    </View>
                    <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textMuted} />
                  </Pressable>
                  {open
                    ? book.chapters.map((ch) => (
                        <Pressable
                          key={ch.id}
                          style={styles.previewCh}
                          onPress={() => setLockedPrompt(true)}
                        >
                          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
                          <Text style={styles.previewChText}>{ch.name}</Text>
                          <Text style={styles.muted}>
                            লিখিত {bn(ch.written_count)} · MCQ {bn(ch.mcq_count)}
                          </Text>
                        </Pressable>
                      ))
                    : null}
                </View>
              );
            })
          )}
        </View>

        <View style={styles.enrollCard}>
          {primaryPkg ? (
            <>
              <Text style={styles.enrollKicker}>
                {primaryPkg.whole_part ? 'পূর্ণ পার্ট অ্যাক্সেস' : 'বিষয়ভিত্তিক প্রস্তুতি প্যাকেজ'}
              </Text>
              <Text style={styles.enrollPrice}>{moneyBn(primaryPkg.price)}</Text>
              <Text style={styles.muted}>{durationBn(primaryPkg.duration_days)}</Text>
            </>
          ) : (
            <>
              <Text style={styles.enrollKicker}>বিষয় আনলক করুন</Text>
              <Text style={styles.enrollPrice}>প্যাকেজে এনরোল করুন</Text>
            </>
          )}
          <Pressable
            style={styles.primaryBtn}
            onPress={() =>
              router.push(`/(app)/pricing?tab=exam_prep&subject=${data.id}` as Href)
            }
          >
            <Text style={styles.primaryBtnText}>এই বিষয়ে এনরোল করুন</Text>
          </Pressable>
          {livePackages.length > 0 ? (
            <Pressable
              style={styles.outlineBtn}
              onPress={() => router.push(`/(app)/pricing?tab=live&subject=${data.id}` as Href)}
            >
              <Text style={styles.outlineBtnText}>
                লাইভ ক্লাস প্যাকেজ ({moneyBn(livePackages[0]!.price)})
              </Text>
            </Pressable>
          ) : null}
          <Pressable onPress={() => router.push('/(app)/live' as Href)}>
            <Text style={styles.linkCenter}>ফ্রি লাইভ ক্লাসের সময়সূচি দেখুন</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  /* Enrolled workspace */
  return (
    <View style={styles.root}>
      {quizSession ? (
        <View style={styles.quizWrap}>
          {quizLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#1566b8" />
            </View>
          ) : (
            <ChapterMcqRunner
              chapterName={quizSession.chapter.name}
              bookName={quizSession.chapter.book_name}
              wrongOnlyMode={quizSession.wrongOnly}
              questions={quizSession.questions}
              onBack={() => setQuizSession(null)}
              onRetakeAll={() => void launchChapterQuiz(quizSession.chapter, false)}
              onRetakeWrong={() => void launchChapterQuiz(quizSession.chapter, true)}
              onProgressSaved={() => void loadWorkspace(true)}
            />
          )}
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                try {
                  await loadWorkspace(true);
                } finally {
                  setRefreshing(false);
                }
              }}
            />
          }
        >
          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          <View style={styles.headerCard}>
            <View style={styles.chipRow}>
              <Text style={styles.navyChip}>{data.part_label}</Text>
              <Text style={styles.ownedChip}>এনরোল করা</Text>
              {data.owned_until ? (
                <Text style={styles.muted}>অ্যাক্সেস শেষ: {accessDate(data.owned_until)}</Text>
              ) : null}
            </View>
            <Text style={styles.h1}>{title}</Text>
            {data.name_bn?.trim() ? <Text style={styles.muted}>{data.name}</Text> : null}

            <View style={styles.actionRow}>
              <Pressable style={styles.primaryBtn} onPress={() => openTab('mcq')}>
                <Ionicons name="play-circle" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>অধ্যায়ভিত্তিক অনুশীলন</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() =>
                  router.push(`/(app)/marathon?exam_subject_id=${data.id}` as Href)
                }
              >
                <Ionicons name="flame" size={16} color="#1566b8" />
                <Text style={styles.secondaryBtnText}>ম্যারাথন রিভিউ</Text>
              </Pressable>
            </View>

            <View style={styles.progressBox}>
              <Text style={styles.progressLabel}>
                সামগ্রিক প্রস্তুতি · {bn(data.progress_percent)}% · লিখিত {bn(data.written_read)}/
                {bn(data.written)} · MCQ {bn(data.mcq_touched)}/{bn(data.mcq)}
              </Text>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(data.progress_percent, 3)}%` }]} />
              </View>
            </View>

            <View style={styles.statGrid}>
              {[
                { label: 'বই', value: bn(data.books), to: 'books' as WorkspaceTab },
                { label: 'লিখিত', value: bn(data.written), to: 'written' as WorkspaceTab },
                { label: 'MCQ', value: bn(data.mcq), to: 'mcq' as WorkspaceTab },
                { label: 'বিগত', value: bn(data.papers), to: 'papers' as WorkspaceTab },
                { label: 'ক্লাস', value: bn(data.past_classes), to: 'live' as WorkspaceTab },
                {
                  label: 'সঠিকতা',
                  value: data.mcq_touched > 0 ? `${bn(mcqAccuracy)}%` : '—',
                  to: 'mcq' as WorkspaceTab,
                },
              ].map((stat) => (
                <Pressable key={stat.label} style={styles.statCell} onPress={() => openTab(stat.to)}>
                  <Text style={styles.statValue}>{stat.value}</Text>
                  <Text style={styles.statLabel}>{stat.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {TABS.map((item) => {
              const active = tab === item.id;
              return (
                <Pressable
                  key={item.id}
                  style={[styles.tabChip, active && styles.tabChipOn]}
                  onPress={() => openTab(item.id)}
                >
                  <Text style={[styles.tabChipText, active && styles.tabChipTextOn]}>{item.label}</Text>
                  {typeof item.count === 'number' ? (
                    <Text style={[styles.tabCount, active && styles.tabCountOn]}>{bn(item.count)}</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {tab === 'overview' ? (
            <View style={styles.tabBody}>
              <View style={styles.card}>
                <View style={styles.rowBetween}>
                  <Text style={styles.cardTitle}>এই বিষয়ের বই ও অধ্যায়সমূহ</Text>
                  <Pressable onPress={() => openTab('books')}>
                    <Text style={styles.link}>সব বই →</Text>
                  </Pressable>
                </View>
                {data.preview_books.length === 0 ? (
                  <Text style={styles.muted}>এই বিষয়ে এখনো প্রকাশিত বই যুক্ত হয়নি।</Text>
                ) : (
                  data.preview_books.map((book, bIdx) => (
                    <View key={book.id} style={styles.bookBlock}>
                      <View style={styles.rowBetween}>
                        <View style={styles.flex1}>
                          <Text style={styles.partLabel}>বই {bn(bIdx + 1)}</Text>
                          <Text style={styles.bookName}>{book.name_bn?.trim() || book.name}</Text>
                        </View>
                        <Pressable
                          style={styles.miniBtn}
                          onPress={() => router.push(`/(app)/books/${book.id}` as Href)}
                        >
                          <Text style={styles.miniBtnText}>বই পড়ুন</Text>
                        </Pressable>
                      </View>
                      {book.chapters.slice(0, 5).map((ch) => {
                        const mcqRow = data.chapters.find((c) => c.id === ch.id);
                        return (
                          <View key={ch.id} style={styles.chRow}>
                            <Text style={styles.chName}>{ch.name}</Text>
                            <View style={styles.chipRow}>
                              {ch.written_count > 0 ? (
                                <Pressable
                                  onPress={() => {
                                    setBookFilter(book.id);
                                    openTab('written');
                                  }}
                                >
                                  <Text style={styles.softChip}>লিখিত {bn(ch.written_count)}</Text>
                                </Pressable>
                              ) : null}
                              {mcqRow ? (
                                <Pressable onPress={() => void launchChapterQuiz(mcqRow, false)}>
                                  <Text style={styles.mcqChip}>কুইজ: {bn(mcqRow.mcq_total)}</Text>
                                </Pressable>
                              ) : null}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  ))
                )}
              </View>

              <Pressable style={styles.quickCard} onPress={() => openTab('written')}>
                <Ionicons name="help-circle-outline" size={22} color="#1566b8" />
                <View style={styles.flex1}>
                  <Text style={styles.quickTitle}>বিষয়ভিত্তিক লিখিত প্রশ্নব্যাংক</Text>
                  <Text style={styles.muted}>
                    পঠিত {bn(data.written_read)} · অপঠিত {bn(Math.max(0, data.written - data.written_read))}
                  </Text>
                </View>
              </Pressable>
              <Pressable style={styles.quickCard} onPress={() => openTab('mcq')}>
                <Ionicons name="checkbox-outline" size={22} color="#156f4d" />
                <View style={styles.flex1}>
                  <Text style={styles.quickTitle}>অধ্যায়ভিত্তিক MCQ ও রিটেস্ট</Text>
                  <Text style={styles.muted}>
                    সঠিক {bn(data.mcq_correct)} · ভুল {bn(data.mcq_wrong)}
                  </Text>
                </View>
              </Pressable>

              <View style={styles.card}>
                <Text style={styles.partLabel}>আগামী লাইভ ক্লাস</Text>
                {nextUpcoming ? (
                  <>
                    <Text style={styles.bookName}>{nextUpcoming.topic}</Text>
                    <Text style={styles.muted}>{formatClassDateTime(nextUpcoming.scheduled_at)}</Text>
                    <Pressable
                      style={styles.primaryBtn}
                      onPress={() => {
                        if (data.live_owned || nextUpcoming.access_type === 'free') {
                          router.push(`/(app)/live/${nextUpcoming.id}` as Href);
                        } else {
                          router.push(`/(app)/pricing?tab=live&subject=${data.id}` as Href);
                        }
                      }}
                    >
                      <Text style={styles.primaryBtnText}>
                        {data.live_owned || nextUpcoming.access_type === 'free'
                          ? 'ক্লাস দেখুন'
                          : 'লাইভ প্যাকেজে এনরোল'}
                      </Text>
                    </Pressable>
                  </>
                ) : (
                  <Text style={styles.muted}>এই বিষয়ে বর্তমানে নির্ধারিত আসন্ন ক্লাস নেই।</Text>
                )}
              </View>
            </View>
          ) : null}

          {tab === 'books' ? (
            <View style={styles.tabBody}>
              {data.books_list.length === 0 ? (
                <Text style={styles.muted}>কোনো বই নেই।</Text>
              ) : (
                data.books_list.map((book) => (
                  <Pressable
                    key={book.id}
                    style={styles.listCard}
                    onPress={() => router.push(`/(app)/books/${book.id}` as Href)}
                  >
                    <View style={styles.flex1}>
                      <Text style={styles.bookName}>{book.name_bn?.trim() || book.name}</Text>
                      <Text style={styles.muted}>
                        {bn(book.chapter_count)}টি অধ্যায়
                        {book.edition ? ` · ${book.edition}` : ''}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          {tab === 'written' ? (
            <View style={styles.tabBody}>
              <View style={styles.filterRow}>
                {(['all', 'unread', 'read'] as const).map((f) => (
                  <Pressable
                    key={f}
                    style={[styles.filterChip, readFilter === f && styles.filterChipOn]}
                    onPress={() => setReadFilter(f)}
                  >
                    <Text style={[styles.filterChipText, readFilter === f && styles.filterChipTextOn]}>
                      {f === 'all' ? 'সব' : f === 'unread' ? 'অপঠিত' : 'পঠিত'}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <View style={styles.searchWrap}>
                <Ionicons name="search" size={16} color={colors.textMuted} />
                <TextInput
                  value={bankSearch}
                  onChangeText={setBankSearch}
                  placeholder="প্রশ্ন খুঁজুন..."
                  placeholderTextColor={colors.textMuted}
                  style={styles.searchInput}
                />
              </View>
              {writtenTypes.length > 0 ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                  <Pressable
                    style={[styles.filterChip, !typeFilter && styles.filterChipOn]}
                    onPress={() => setTypeFilter('')}
                  >
                    <Text style={[styles.filterChipText, !typeFilter && styles.filterChipTextOn]}>সব ধরন</Text>
                  </Pressable>
                  {writtenTypes.map((code) => (
                    <Pressable
                      key={code}
                      style={[styles.filterChip, typeFilter === code && styles.filterChipOn]}
                      onPress={() => setTypeFilter(code)}
                    >
                      <Text style={[styles.filterChipText, typeFilter === code && styles.filterChipTextOn]}>
                        {QUESTION_TYPE_LABELS[code] ?? code}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {writtenGroupedByBook.length === 0 ? (
                <Text style={styles.muted}>কোনো লিখিত প্রশ্ন নেই।</Text>
              ) : (
                writtenGroupedByBook.map((group) => (
                  <View key={group.key} style={styles.card}>
                    <View style={styles.bookTitleBanner}>
                      <Text style={styles.bookTitleHighlight}>{group.bookName}</Text>
                    </View>
                    {group.items.map((q) => (
                      <Pressable
                        key={q.id}
                        style={styles.writtenRow}
                        onPress={() => router.push(`/(app)/questions/${q.id}` as Href)}
                      >
                        <View style={styles.flex1}>
                          <Text style={styles.writtenTitle}>{q.title}</Text>
                          <Text style={styles.muted}>
                            {QUESTION_TYPE_LABELS[q.question_type_code] ?? q.question_type_code}
                            {q.chapter_name ? ` · ${q.chapter_name}` : ''}
                            {q.read_count > 0 ? ` · পঠিত ${bn(q.read_count)}` : ' · অপঠিত'}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === 'mcq' ? (
            <View style={styles.tabBody}>
              {quizLoading ? <ActivityIndicator color="#1566b8" /> : null}
              {chaptersGroupedByBook.length === 0 ? (
                <Text style={styles.muted}>কোনো অধ্যায়ভিত্তিক MCQ নেই।</Text>
              ) : (
                chaptersGroupedByBook.map((group) => (
                  <View key={group.key} style={styles.card}>
                    <View style={styles.bookTitleBanner}>
                      <Text style={styles.bookTitleHighlight}>{group.bookName}</Text>
                    </View>
                    {group.chapters.map((ch) => {
                      const acc =
                        ch.touched > 0 ? Math.round((ch.correct / ch.touched) * 100) : null;
                      return (
                        <View key={ch.id} style={styles.mcqRow}>
                          <View style={styles.flex1}>
                            <Text style={styles.bookName}>{ch.name}</Text>
                            <Text style={styles.muted}>
                              {bn(ch.touched)}/{bn(ch.mcq_total)} উত্তর
                              {acc !== null ? ` · ${bn(acc)}% সঠিক` : ''}
                              {ch.wrong > 0 ? ` · ভুল ${bn(ch.wrong)}` : ''}
                            </Text>
                          </View>
                          <View style={styles.mcqActions}>
                            <Pressable
                              style={styles.primaryBtn}
                              onPress={() => void launchChapterQuiz(ch, false)}
                            >
                              <Text style={styles.primaryBtnText}>কুইজ</Text>
                            </Pressable>
                            {ch.wrong > 0 ? (
                              <Pressable
                                style={styles.outlineBtn}
                                onPress={() => void launchChapterQuiz(ch, true)}
                              >
                                <Text style={styles.outlineBtnText}>ভুল</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                ))
              )}
            </View>
          ) : null}

          {tab === 'papers' ? (
            <View style={styles.tabBody}>
              {data.papers_list.length === 0 ? (
                <Text style={styles.muted}>কোনো বিগত সেট নেই।</Text>
              ) : (
                data.papers_list.map((paper) => (
                  <Pressable
                    key={paper.id}
                    style={styles.listCard}
                    onPress={() => router.push(`/(app)/papers/${paper.id}` as Href)}
                  >
                    <View style={styles.flex1}>
                      <View style={styles.chipRow}>
                        {paper.is_exam_of_week ? <Text style={styles.weekChip}>Exam of the Week</Text> : null}
                      </View>
                      <Text style={styles.bookName}>{paper.name}</Text>
                      <Text style={styles.muted}>
                        {bn(paper.question_count)}টি প্রশ্ন · {bn(paper.duration_minutes)} মিনিট ·{' '}
                        {bn(paper.total_marks)} নম্বর
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                  </Pressable>
                ))
              )}
            </View>
          ) : null}

          {tab === 'live' ? (
            <View style={styles.tabBody}>
              <Pressable
                style={styles.quickCard}
                onPress={() => router.push(`/(app)/marathon?exam_subject_id=${data.id}` as Href)}
              >
                <Ionicons name="flame" size={22} color="#1566b8" />
                <View style={styles.flex1}>
                  <Text style={styles.quickTitle}>ম্যারাথন রিভিউ</Text>
                  <Text style={styles.muted}>এই বিষয়ের প্রশ্ন একটানা রিভিশন</Text>
                </View>
              </Pressable>
              {upcomingClasses.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>আসন্ন ক্লাস</Text>
                  {upcomingClasses.map((c) => (
                    <Pressable
                      key={c.id}
                      style={styles.listCard}
                      onPress={() => {
                        if (data.live_owned || c.access_type === 'free') {
                          router.push(`/(app)/live/${c.id}` as Href);
                        } else {
                          router.push(`/(app)/pricing?tab=live&subject=${data.id}` as Href);
                        }
                      }}
                    >
                      <View style={styles.flex1}>
                        <Text style={styles.bookName}>{c.topic}</Text>
                        <Text style={styles.muted}>{formatClassDateTime(c.scheduled_at)}</Text>
                      </View>
                      <Text style={styles.softChip}>{c.access_type === 'free' ? 'ফ্রি' : 'পেইড'}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {pastClasses.length > 0 ? (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>সম্পন্ন ক্লাস</Text>
                  {pastClasses.map((c) => (
                    <Pressable
                      key={c.id}
                      style={styles.listCard}
                      onPress={() => router.push(`/(app)/live/${c.id}` as Href)}
                    >
                      <View style={styles.flex1}>
                        <Text style={styles.bookName}>{c.topic}</Text>
                        <Text style={styles.muted}>{formatClassDateTime(c.scheduled_at)}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
              {upcomingClasses.length === 0 && pastClasses.length === 0 ? (
                <Text style={styles.muted}>এই বিষয়ে কোনো ক্লাস নেই।</Text>
              ) : null}

              <View style={styles.card}>
                <Text style={styles.cardTitle}>আরও টুলস</Text>
                {(
                  [
                    {
                      label: 'সিলেবাস',
                      href: `/(app)/exams/subjects/${data.id}` as Href,
                      icon: 'list-outline' as const,
                    },
                    {
                      label: 'Question Bank',
                      href: '/(app)/questions' as Href,
                      icon: 'help-circle-outline' as const,
                    },
                    { label: 'QOTD', href: '/(app)/qotd' as Href, icon: 'today-outline' as const },
                    {
                      label: 'Exam of the Week',
                      href: '/(app)/exam-week' as Href,
                      icon: 'calendar-outline' as const,
                    },
                    {
                      label: 'Exam Routine',
                      href: '/(app)/exam-routine' as Href,
                      icon: 'time-outline' as const,
                    },
                  ] as const
                ).map((tool) => (
                  <Pressable
                    key={tool.label}
                    style={styles.listCard}
                    onPress={() => router.push(tool.href)}
                  >
                    <Ionicons name={tool.icon} size={18} color="#1566b8" />
                    <Text style={[styles.bookName, styles.flex1]}>{tool.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  quizWrap: { flex: 1, padding: spacing.lg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg, gap: 12 },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  flex1: { flex: 1, minWidth: 0 },
  errorText: { color: colors.error, textAlign: 'center' },
  errorBanner: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    overflow: 'hidden',
  },
  lockedHero: {
    backgroundColor: '#0a2f5b',
    borderRadius: 18,
    padding: spacing.md,
    gap: 8,
  },
  lockedTitle: { color: '#fff', fontSize: 22, fontWeight: '800' },
  lockedEn: { color: 'rgba(255,255,255,0.75)', fontSize: 12 },
  lockedDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  heroChip: {
    backgroundColor: '#1566b8',
    color: '#fff',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
  },
  heroChipMuted: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
  },
  statChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    color: '#fff',
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '700',
  },
  lockPrompt: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: '#fff8ee',
    borderWidth: 1,
    borderColor: '#f3d7a1',
    borderRadius: 14,
    padding: 12,
  },
  lockPromptText: { flex: 1, fontSize: 12, color: '#0a2f5b', lineHeight: 17 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.md,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: '800', color: '#0a2f5b' },
  bookTitleBanner: {
    backgroundColor: '#e8f2fc',
    borderLeftWidth: 4,
    borderLeftColor: '#0a2f5b',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  bookTitleHighlight: { fontSize: 15, fontWeight: '800', color: '#0a2f5b' },
  muted: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  previewBook: { borderWidth: 1, borderColor: '#e6eff7', borderRadius: 12, overflow: 'hidden' },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12 },
  previewName: { fontSize: 14, fontWeight: '800', color: '#0a2f5b' },
  previewCh: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eef4f9',
  },
  previewChText: { flex: 1, fontSize: 12, fontWeight: '600', color: '#0a2f5b' },
  enrollCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.md,
    gap: 10,
  },
  enrollKicker: { fontSize: 12, fontWeight: '700', color: '#1566b8' },
  enrollPrice: { fontSize: 26, fontWeight: '900', color: '#0a2f5b' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#1566b8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#1566b8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
  },
  outlineBtnText: { color: '#1566b8', fontSize: 12, fontWeight: '700' },
  secondaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: '#f4f9fd',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  secondaryBtnText: { color: '#0a2f5b', fontSize: 12, fontWeight: '700' },
  linkCenter: { textAlign: 'center', fontSize: 12, fontWeight: '700', color: '#1566b8' },
  link: { fontSize: 12, fontWeight: '700', color: '#1566b8' },
  headerCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.md,
    gap: 10,
  },
  navyChip: {
    backgroundColor: '#0a2f5b',
    color: '#fff',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
  },
  ownedChip: {
    backgroundColor: '#e8f8ef',
    color: '#156f4d',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
  },
  h1: { fontSize: 22, fontWeight: '800', color: '#0a2f5b' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  progressBox: { backgroundColor: '#f4f9fd', borderRadius: 12, padding: 12, gap: 8 },
  progressLabel: { fontSize: 11, fontWeight: '700', color: '#0a2f5b', lineHeight: 16 },
  track: { height: 8, borderRadius: 999, backgroundColor: '#dce9f5', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#1566b8', borderRadius: 999 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell: {
    width: '30%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#e5eef7',
    borderRadius: 12,
    padding: 10,
  },
  statValue: { fontSize: 16, fontWeight: '900', color: '#0a2f5b' },
  statLabel: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  tabRow: { gap: 8, paddingRight: spacing.lg },
  tabChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  tabChipOn: { backgroundColor: '#0a2f5b', borderColor: '#0a2f5b' },
  tabChipText: { fontSize: 11, fontWeight: '700', color: '#0a2f5b' },
  tabChipTextOn: { color: '#fff' },
  tabCount: {
    backgroundColor: '#f4f9fd',
    color: colors.textMuted,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 10,
    fontWeight: '700',
  },
  tabCountOn: { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' },
  tabBody: { gap: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  bookBlock: { borderWidth: 1, borderColor: '#e6eff7', borderRadius: 12, padding: 12, gap: 8 },
  partLabel: { fontSize: 11, fontWeight: '700', color: '#1566b8' },
  bookName: { fontSize: 14, fontWeight: '800', color: '#0a2f5b' },
  miniBtn: {
    backgroundColor: '#eaf3fc',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  miniBtnText: { fontSize: 11, fontWeight: '700', color: '#1566b8' },
  chRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eef4f9',
  },
  chName: { flex: 1, fontSize: 12, fontWeight: '600', color: '#0a2f5b' },
  softChip: {
    backgroundColor: '#f4f9fd',
    color: colors.textMuted,
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  mcqChip: {
    backgroundColor: '#eaf3fc',
    color: '#1566b8',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  quickCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: 14,
  },
  quickTitle: { fontSize: 14, fontWeight: '800', color: '#0a2f5b' },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: 12,
  },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterChip: {
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: '#f4f9fd',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterChipOn: { backgroundColor: '#0a2f5b', borderColor: '#0a2f5b' },
  filterChipText: { fontSize: 11, fontWeight: '700', color: '#0a2f5b' },
  filterChipTextOn: { color: '#fff' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0a2f5b', paddingVertical: 0 },
  writtenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eef4f9',
  },
  writtenTitle: { fontSize: 13, fontWeight: '700', color: '#0a2f5b', lineHeight: 18 },
  mcqRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eef4f9',
  },
  mcqActions: { gap: 6 },
  weekChip: {
    backgroundColor: '#dc2626',
    color: '#fff',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '800',
  },
});
