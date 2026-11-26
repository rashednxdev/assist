import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import type { PreparationSubjectSummary } from '@ibas/shared-types';
import { ModuleWelcomeTips } from '@/components/home/ModuleWelcomeTips';
import { MenuTriggerButton } from '@/components/navigation/AppMenu';
import { isModuleWelcomeTipsPending } from '@/lib/module-welcome-tips';
import { useAuth } from '@/lib/auth-context';
import { hasLearningModule } from '@/lib/api';
import { fetchExamPrepSubjects } from '@/lib/exam-prep-api';
import { fetchExamRoutineList, type ExamRoutineListItem } from '@/lib/exam-routine-api';
import { fetchMyNotifications } from '@/lib/notifications-api';
import { fetchLiveStreams, type LiveStreamListItem } from '@/lib/live-stream-api';
import { fetchPapers } from '@/lib/papers-api';
import type { PaperItem } from '@/types/papers';
import { toBanglaDigits } from '@/lib/bangla-format';
import { colors, spacing } from '@/theme';

const CARD_HEADERS = ['#0a2f5b', '#1566b8', '#1f8a96'];
const BANGLA_MONTHS = ['জানু', 'ফেব্রু', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টে', 'অক্টো', 'নভে', 'ডিসে'];

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function greetingNow(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'শুভ সকাল';
  if (hour < 17) return 'শুভ অপরাহ্ন';
  if (hour < 20) return 'শুভ সন্ধ্যা';
  return 'শুভ রাত্রি';
}

function displayName(user: { full_name_en?: string; full_name_bn?: string } | null | undefined): string {
  return user?.full_name_bn?.trim() || user?.full_name_en?.trim() || 'স্বাগতম';
}

function daysUntil(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y!, (m ?? 1) - 1, d ?? 1);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function dateBoxParts(dateStr: string): { day: string; month: string } {
  const [, m, d] = dateStr.split('-').map(Number);
  return {
    day: bn(d ?? 1),
    month: BANGLA_MONTHS[(m ?? 1) - 1] ?? '',
  };
}

function formatClassWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('bn-BD', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeUntilShort(iso: string): string | null {
  const diff = new Date(iso).getTime() - Date.now();
  if (!Number.isFinite(diff) || diff <= 0) return null;
  const mins = Math.round(diff / 60_000);
  if (mins < 60) return `শুরু হতে ${bn(mins)} মিনিট বাকি`;
  const hrs = Math.floor(mins / 60);
  const rem = mins % 60;
  if (hrs < 24) return `শুরু হতে ${bn(hrs)} ঘণ্টা ${rem > 0 ? `${bn(rem)} মি` : ''} বাকি`.trim();
  const days = Math.ceil(hrs / 24);
  return `${bn(days)} দিন পর`;
}

function nextLiveClass(rows: LiveStreamListItem[]): LiveStreamListItem | null {
  const live = rows.find((row) => row.status === 'live');
  if (live) return live;
  const now = Date.now();
  return (
    rows
      .filter(
        (row) =>
          row.status !== 'ended' &&
          row.status !== 'cancelled' &&
          new Date(row.scheduled_at).getTime() >= now - 60 * 60 * 1000,
      )
      .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())[0] ?? null
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { user, refreshUser } = useAuth();
  const [subjects, setSubjects] = useState<PreparationSubjectSummary[] | null>(null);
  const [routines, setRoutines] = useState<ExamRoutineListItem[]>([]);
  const [papers, setPapers] = useState<PaperItem[]>([]);
  const [liveRows, setLiveRows] = useState<LiveStreamListItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [welcomeTipsOpen, setWelcomeTipsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadData = useCallback(async () => {
    const canPaper = hasLearningModule(user?.module_access ?? [], 'PAPER') && user?.has_paid !== false;
    const [subs, live, routine, paperList] = await Promise.all([
      fetchExamPrepSubjects().catch(() => [] as PreparationSubjectSummary[]),
      fetchLiveStreams('zoom').catch(() => [] as LiveStreamListItem[]),
      fetchExamRoutineList()
        .then((r) => r.data)
        .catch(() => [] as ExamRoutineListItem[]),
      canPaper
        ? fetchPapers({ is_published: 'true' }).catch(() => [] as PaperItem[])
        : Promise.resolve([] as PaperItem[]),
    ]);
    setSubjects(subs);
    setLiveRows(Array.isArray(live) ? live : []);
    setRoutines(routine);
    setPapers(paperList);
  }, [user?.module_access, user?.has_paid]);

  const loadUnreadCount = useCallback(async () => {
    const res = await fetchMyNotifications(true).catch(() => null);
    setUnreadCount(res?.meta.unread_count ?? 0);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadData(), loadUnreadCount(), refreshUser().catch(() => null)]);
    } finally {
      setRefreshing(false);
    }
  }, [loadData, loadUnreadCount, refreshUser]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void isModuleWelcomeTipsPending().then((pending) => {
      if (pending) setWelcomeTipsOpen(true);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshUser().catch(() => {});
      void loadUnreadCount();
      void loadData();
    }, [refreshUser, loadUnreadCount, loadData]),
  );

  const enrolled = useMemo(() => (subjects ?? []).filter((s) => s.owned), [subjects]);
  const offered = useMemo(() => (subjects ?? []).filter((s) => !s.owned), [subjects]);
  const nextLive = useMemo(() => nextLiveClass(liveRows), [liveRows]);
  const startsIn = nextLive ? timeUntilShort(nextLive.scheduled_at) : null;

  const upcomingRoutines = useMemo(
    () =>
      routines
        .map((r) => ({ ...r, days: daysUntil(r.start_date) }))
        .filter((r) => r.days >= 0)
        .sort((a, b) => a.days - b.days)
        .slice(0, 3),
    [routines],
  );
  const nearestExam = upcomingRoutines[0] ?? null;

  const overallPrepPercent = useMemo(() => {
    if (enrolled.length === 0) return 0;
    return Math.round(enrolled.reduce((acc, s) => acc + s.progress_percent, 0) / enrolled.length);
  }, [enrolled]);

  const accuracySummary = useMemo(() => {
    const withMcq = (subjects ?? []).filter((s) => s.owned && s.mcq_touched > 0);
    const touched = withMcq.reduce((sum, s) => sum + s.mcq_touched, 0);
    const correct = withMcq.reduce((sum, s) => sum + s.mcq_correct, 0);
    const overall = touched > 0 ? Math.round((correct / touched) * 100) : 0;
    const rows = withMcq
      .map((s) => ({
        id: s.id,
        title: s.name_bn?.trim() || s.name,
        percent: Math.round((s.mcq_correct / s.mcq_touched) * 100),
      }))
      .sort((a, b) => b.percent - a.percent);
    const weakest = rows.length > 0 ? rows[rows.length - 1] : null;
    return { touched, overall, rows: rows.slice(0, 4), weakest };
  }, [subjects]);

  const featuredPaper = papers.find((p) => p.is_exam_of_week) ?? papers[0] ?? null;
  const enrollPill =
    enrolled.length > 0 ? `${bn(enrolled.length)}টি বিষয়ে এনরোল` : 'সকল বিষয়ের সারাংশ উন্মুক্ত';

  return (
    <View style={styles.root}>
      <LinearGradient colors={['#0a2f5b', '#1566b8']} style={styles.hero}>
        <SafeAreaView edges={['top']}>
          <View style={styles.heroInner}>
            <MenuTriggerButton />
            <View style={styles.heroText}>
              <Text style={styles.greet}>
                {greetingNow()}, {displayName(user)}
              </Text>
              <Text style={styles.heroSub}>
                {enrolled.length > 0
                  ? 'পদোন্নতি ও বিভাগীয় পরীক্ষার বিষয়ভিত্তিক প্রস্তুতি।'
                  : 'বিষয়ভিত্তিক প্রস্তুতি শুরু করতে আপনার প্রয়োজনীয় বিষয়ে এনরোল করুন।'}
              </Text>
            </View>
            <View style={styles.heroActions}>
              <Pressable
                onPress={() => router.push('/(app)/exam-prep' as Href)}
                style={styles.enrollPill}
              >
                <Text style={styles.enrollPillText}>{enrollPill}</Text>
              </Pressable>
              <Pressable
                onPress={() => router.push('/(app)/notifications' as Href)}
                style={styles.menuBtn}
                accessibilityLabel="Notifications"
                hitSlop={8}
              >
                <Ionicons name="notifications-outline" size={20} color={colors.white} />
                {unreadCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                  </View>
                )}
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Pressable
          style={({ pressed }) => [styles.salaryCta, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/salary' as Href)}
        >
          <Ionicons name="calculator-outline" size={18} color="#fff" />
          <View style={styles.flex1}>
            <Text style={styles.salaryTitle}>বেতন ও বকেয়া হিসাব</Text>
            <Text style={styles.salarySub}>বেতন স্কেল, টি.আর. ফরম ও বকেয়া বিল</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.8)" />
        </Pressable>

        {nextLive ? (
          <View style={styles.liveHero}>
            <View style={styles.liveBadges}>
              <View style={styles.liveBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.liveBadgeText}>
                  {nextLive.status === 'live' ? 'লাইভ চলছে' : `লাইভ · ${formatClassWhen(nextLive.scheduled_at)}`}
                </Text>
              </View>
              {nextLive.access_type === 'free' ? (
                <View style={[styles.liveBadge, { backgroundColor: 'rgba(40,184,216,0.25)' }]}>
                  <Text style={[styles.liveBadgeText, { color: '#8be9f5' }]}>ফ্রি ক্লাস</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.liveTitle}>{nextLive.topic}</Text>
            <Text style={styles.liveMeta}>
              {[nextLive.host_name, startsIn].filter(Boolean).join(' · ') ||
                formatClassWhen(nextLive.scheduled_at)}
            </Text>
            <View style={styles.liveActions}>
              <Pressable
                style={styles.primaryBtn}
                onPress={() => router.push(`/(app)/live/${nextLive.id}` as Href)}
              >
                <Ionicons name="videocam" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>ক্লাসে যোগ দিন</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/(app)/live' as Href)}>
                <Text style={styles.liveAllLink}>সব লাইভ ক্লাস →</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.liveHero}>
            <Text style={styles.promoTag}>বিষয়ভিত্তিক প্রস্তুতি</Text>
            <Text style={styles.liveTitle}>
              প্রতিটি বিষয়ের বই, লিখিত প্রশ্ন, MCQ ও লাইভ ক্লাস এক ওয়ার্কস্পেসে
            </Text>
            <Text style={styles.liveMeta}>
              ফ্রি লাইভ ক্লাস এনরোল ছাড়াই দেখা যায়। যেকোনো বিষয়ের রিসোর্স সারাংশ দেখে প্রস্তুতি শুরু করুন।
            </Text>
            <View style={styles.liveActions}>
              <Pressable style={styles.primaryBtn} onPress={() => router.push('/(app)/exam-prep' as Href)}>
                <Ionicons name="school" size={16} color="#fff" />
                <Text style={styles.primaryBtnText}>Exam Preparations</Text>
              </Pressable>
              <Pressable style={styles.ghostBtn} onPress={() => router.push('/(app)/live' as Href)}>
                <Text style={styles.ghostBtnText}>Live Classes</Text>
              </Pressable>
            </View>
          </View>
        )}

        <View style={styles.prepCard}>
          <View style={styles.prepHead}>
            <Text style={styles.prepEyebrow}>
              {nearestExam ? 'সামনের পরীক্ষা' : 'সামগ্রিক প্রস্তুতি'}
            </Text>
            <Ionicons name="calendar-outline" size={16} color="#1566b8" />
          </View>
          {nearestExam ? (
            <>
              <Text style={styles.prepName} numberOfLines={1}>
                {nearestExam.exam_name}
              </Text>
              <Text style={styles.prepBig}>
                {nearestExam.days === 0 ? 'আজ' : `${bn(nearestExam.days)} দিন বাকি`}
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.prepName}>এনরোল করা বিষয়ের অগ্রগতি</Text>
              <Text style={styles.prepBig}>{bn(overallPrepPercent)}%</Text>
            </>
          )}
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${Math.max(overallPrepPercent, enrolled.length > 0 ? 4 : 0)}%` },
              ]}
            />
          </View>
          <Pressable onPress={() => router.push('/(app)/exam-routine' as Href)}>
            <Text style={styles.link}>পরীক্ষার রুটিন ও বিজ্ঞপ্তি দেখুন →</Text>
          </Pressable>
        </View>

        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>চালিয়ে যান</Text>
          <Pressable onPress={() => router.push('/(app)/exam-prep' as Href)}>
            <Text style={styles.link}>সব বিষয় দেখুন</Text>
          </Pressable>
        </View>

        {enrolled.length === 0 ? (
          <View style={styles.emptyEnroll}>
            <Text style={styles.emptyTitle}>এখনো কোনো বিষয়ে এনরোল করা হয়নি</Text>
            <Text style={styles.emptySub}>
              Exam Preparations থেকে প্রতিটি বিষয়ের বই, লিখিত প্রশ্ন ও MCQ সংখ্যা দেখে পছন্দের প্যাকেজে এনরোল করুন।
            </Text>
            <View style={styles.liveActions}>
              <Pressable style={styles.secondaryBtn} onPress={() => router.push('/(app)/exam-prep' as Href)}>
                <Text style={styles.secondaryBtnText}>বিষয়সমূহ দেখুন</Text>
              </Pressable>
              <Pressable style={styles.primaryBtn} onPress={() => router.push('/(app)/pricing?tab=exam_prep' as Href)}>
                <Text style={styles.primaryBtnText}>কোর্স ও প্যাকেজ</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.subjectList}>
            {enrolled.slice(0, 4).map((subject, idx) => {
              const title = subject.name_bn?.trim() || subject.name;
              const totalItems = subject.written + subject.mcq;
              const doneItems = subject.written_read + subject.mcq_touched;
              return (
                <Pressable
                  key={subject.id}
                  style={({ pressed }) => [styles.subjectRow, pressed && styles.pressed]}
                  onPress={() => router.push(`/(app)/exam-prep/${subject.id}` as Href)}
                >
                  <View style={[styles.subjectIcon, { backgroundColor: CARD_HEADERS[idx % CARD_HEADERS.length] }]}>
                    <Ionicons name="book-outline" size={20} color="#fff" />
                  </View>
                  <View style={styles.flex1}>
                    <Text style={styles.partLabel}>{subject.part_label}</Text>
                    <Text style={styles.subjectTitle} numberOfLines={1}>
                      {title}
                    </Text>
                    <View style={styles.miniProgressRow}>
                      <View style={styles.miniTrack}>
                        <View
                          style={[styles.miniFill, { width: `${Math.max(subject.progress_percent, 4)}%` }]}
                        />
                      </View>
                      <Text style={styles.miniCount}>
                        {bn(doneItems)} / {bn(totalItems)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.continueChip}>
                    <Text style={styles.continueChipText}>চালিয়ে যান</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {featuredPaper ? (
          <View style={styles.paperBanner}>
            <View style={styles.paperIcon}>
              <Ionicons name="document-text-outline" size={20} color="#b45309" />
            </View>
            <View style={styles.flex1}>
              <Text style={styles.paperTitle}>{featuredPaper.name}</Text>
              <Text style={styles.paperMeta}>
                {bn(featuredPaper.question_count)}টি প্রশ্ন · {bn(featuredPaper.duration_minutes)} মিনিট
                {featuredPaper.exam_subject_name ? ` · ${featuredPaper.exam_subject_name}` : ''}
              </Text>
            </View>
            <Pressable
              style={styles.primaryBtn}
              onPress={() => router.push(`/(app)/papers/${featuredPaper.id}` as Href)}
            >
              <Text style={styles.primaryBtnText}>শুরু করুন</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.twoCol}>
          <View style={styles.panel}>
            <View style={styles.sectionHead}>
              <Text style={styles.panelTitle}>পরীক্ষার রুটিন</Text>
              <Pressable onPress={() => router.push('/(app)/exam-routine' as Href)}>
                <Text style={styles.linkSm}>ক্যালেন্ডার</Text>
              </Pressable>
            </View>
            {upcomingRoutines.length === 0 ? (
              <Text style={styles.emptySub}>বর্তমানে কোনো আসন্ন পরীক্ষার তারিখ ঘোষিত নেই।</Text>
            ) : (
              upcomingRoutines.map((item) => {
                const box = dateBoxParts(item.start_date);
                return (
                  <Pressable
                    key={item.exam_name_id}
                    style={styles.routineRow}
                    onPress={() => router.push(`/(app)/exam-routine/${item.exam_name_id}` as Href)}
                  >
                    <View style={styles.dateBox}>
                      <Text style={styles.dateDay}>{box.day}</Text>
                      <Text style={styles.dateMonth}>{box.month}</Text>
                    </View>
                    <View style={styles.flex1}>
                      <Text style={styles.routineName} numberOfLines={1}>
                        {item.exam_name}
                      </Text>
                      <Text style={styles.routineNote} numberOfLines={1}>
                        {item.start_date_note?.trim() || 'পরীক্ষার সময়সূচি দেখুন'}
                      </Text>
                    </View>
                    <Text style={styles.daysChip}>
                      {item.days === 0 ? 'আজ' : `${bn(item.days)} দিন`}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </View>

          <View style={styles.panel}>
            <View style={styles.sectionHead}>
              <Text style={styles.panelTitle}>আপনার নির্ভুলতা</Text>
              <Pressable onPress={() => router.push('/(app)/exam-prep' as Href)}>
                <Text style={styles.linkSm}>বিস্তারিত</Text>
              </Pressable>
            </View>
            {accuracySummary.touched === 0 ? (
              <Text style={styles.emptySub}>
                এনরোল করা বিষয়ের অধ্যায়ভিত্তিক MCQ উত্তর দিলে এখানে সঠিকতার হার দেখা যাবে।
              </Text>
            ) : (
              <>
                <Text style={styles.accuracyBig}>{bn(accuracySummary.overall)}%</Text>
                <Text style={styles.emptySub}>
                  মোট {bn(accuracySummary.touched)}টি অনুশীলনে গড় সঠিকতা
                </Text>
                {accuracySummary.rows.map((row) => (
                  <View key={row.id} style={styles.accRow}>
                    <View style={styles.accLabels}>
                      <Text style={styles.accName} numberOfLines={1}>
                        {row.title}
                      </Text>
                      <Text style={styles.accPct}>{bn(row.percent)}%</Text>
                    </View>
                    <View style={styles.miniTrack}>
                      <View
                        style={[
                          styles.miniFill,
                          {
                            width: `${Math.max(row.percent, 5)}%`,
                            backgroundColor:
                              row.percent >= 75 ? '#1f9d68' : row.percent >= 55 ? '#1566b8' : '#e07c24',
                          },
                        ]}
                      />
                    </View>
                  </View>
                ))}
                {accuracySummary.weakest && accuracySummary.weakest.percent < 75 ? (
                  <Pressable
                    onPress={() =>
                      router.push(`/(app)/exam-prep/${accuracySummary.weakest!.id}` as Href)
                    }
                  >
                    <Text style={styles.weakHint}>
                      <Text style={{ fontWeight: '800' }}>{accuracySummary.weakest.title}</Text> বিষয়ে
                      আরও অনুশীলন করুন →
                    </Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>
        </View>

        <View style={styles.askBanner}>
          <View style={styles.askIcon}>
            <Ionicons name="sparkles" size={18} color="#fff" />
          </View>
          <View style={styles.flex1}>
            <Text style={styles.askTitle}>Ask ProAssist</Text>
            <Text style={styles.emptySub}>
              কোনো বিধি বা পরীক্ষার প্রশ্ন নিয়ে জিজ্ঞাসা আছে? বিষয় উল্লেখ করে প্রশ্ন পাঠান।
            </Text>
          </View>
          <Pressable style={styles.primaryBtn} onPress={() => router.push('/(app)/user-questions' as Href)}>
            <Text style={styles.primaryBtnText}>প্রশ্ন করুন</Text>
          </Pressable>
        </View>

        {offered.length > 0 ? (
          <>
            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>আপনার জন্য প্রস্তাবিত</Text>
              <Pressable onPress={() => router.push('/(app)/pricing?tab=exam_prep' as Href)}>
                <Text style={styles.link}>সব কোর্স</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.offerRow}>
              {offered.slice(0, 3).map((subject, idx) => {
                const title = subject.name_bn?.trim() || subject.name;
                const cheapest = subject.packages.slice().sort((a, b) => a.price - b.price)[0];
                return (
                  <Pressable
                    key={subject.id}
                    style={styles.offerCard}
                    onPress={() => router.push(`/(app)/exam-prep/${subject.id}` as Href)}
                  >
                    <View
                      style={[styles.offerHeader, { backgroundColor: CARD_HEADERS[idx % CARD_HEADERS.length] }]}
                    >
                      <Text style={styles.offerPart}>{subject.part_label}</Text>
                      <Ionicons name="school-outline" size={22} color="rgba(255,255,255,0.8)" />
                    </View>
                    <View style={styles.offerBody}>
                      <Text style={styles.offerTag}>পরীক্ষা প্রস্তুতি</Text>
                      <Text style={styles.offerTitle} numberOfLines={2}>
                        {title}
                      </Text>
                      <Text style={styles.offerMeta}>
                        {bn(subject.books)}টি বই · {bn(subject.written)}টি লিখিত · {bn(subject.mcq)}টি MCQ
                      </Text>
                      <View style={styles.offerFooter}>
                        <Text style={styles.offerPrice}>
                          {cheapest ? `৳${cheapest.price.toLocaleString('bn-BD')}` : 'প্যাকেজ দেখুন'}
                        </Text>
                        <Text style={styles.offerCta}>দেখুন</Text>
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : null}
      </ScrollView>

      <ModuleWelcomeTips visible={welcomeTipsOpen} onDone={() => setWelcomeTipsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  flex1: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.92 },
  hero: { paddingBottom: spacing.md },
  heroInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  heroText: { flex: 1, minWidth: 0 },
  greet: { color: colors.white, fontSize: 20, fontWeight: '800' },
  heroSub: { color: 'rgba(255,255,255,0.85)', fontSize: 12, marginTop: 4, lineHeight: 17 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  enrollPill: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: 140,
  },
  enrollPillText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#0a2f5b',
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: '800' },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  salaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#9f1239',
    borderRadius: 14,
    padding: 12,
  },
  salaryTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  salarySub: { color: 'rgba(255,255,255,0.85)', fontSize: 11, marginTop: 2 },
  liveHero: {
    backgroundColor: '#0a2f5b',
    borderRadius: 18,
    padding: spacing.md,
    gap: 8,
  },
  liveBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1566b8',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#28b8d8' },
  liveBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  promoTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '700',
  },
  liveTitle: { color: '#fff', fontSize: 18, fontWeight: '800', lineHeight: 24 },
  liveMeta: { color: 'rgba(255,255,255,0.75)', fontSize: 12, lineHeight: 17 },
  liveActions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginTop: 6 },
  liveAllLink: { color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700' },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1566b8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  primaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  ghostBtn: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ghostBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: '#f4f9fd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtnText: { color: '#0a2f5b', fontSize: 12, fontWeight: '700' },
  prepCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.md,
    gap: 8,
  },
  prepHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prepEyebrow: { fontSize: 11, fontWeight: '800', color: colors.textMuted, letterSpacing: 0.4 },
  prepName: { fontSize: 13, fontWeight: '700', color: '#0a2f5b' },
  prepBig: { fontSize: 28, fontWeight: '900', color: '#0a2f5b' },
  progressTrack: { height: 8, borderRadius: 999, backgroundColor: '#e6eff7', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#1566b8', borderRadius: 999 },
  link: { fontSize: 12, fontWeight: '700', color: '#1566b8' },
  linkSm: { fontSize: 11, fontWeight: '700', color: '#1566b8' },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0a2f5b' },
  emptyEnroll: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.md,
    gap: 8,
  },
  emptyTitle: { fontSize: 14, fontWeight: '800', color: '#0a2f5b' },
  emptySub: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  subjectList: { gap: 10 },
  subjectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: 12,
  },
  subjectIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  partLabel: { fontSize: 11, fontWeight: '700', color: '#1566b8' },
  subjectTitle: { fontSize: 14, fontWeight: '800', color: '#0a2f5b' },
  miniProgressRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  miniTrack: { flex: 1, height: 6, borderRadius: 999, backgroundColor: '#e6eff7', overflow: 'hidden' },
  miniFill: { height: '100%', backgroundColor: '#1566b8', borderRadius: 999 },
  miniCount: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  continueChip: {
    backgroundColor: '#f4f9fd',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  continueChipText: { fontSize: 11, fontWeight: '800', color: '#1566b8' },
  paperBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#fff9eb',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#f2d9a0',
    padding: 12,
  },
  paperIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(245,158,11,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperTitle: { fontSize: 13, fontWeight: '800', color: '#0a2f5b' },
  paperMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  twoCol: { gap: 12 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.md,
    gap: 10,
  },
  panelTitle: { fontSize: 15, fontWeight: '800', color: '#0a2f5b' },
  routineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: '#e6eff7',
    borderRadius: 12,
    padding: 10,
  },
  dateBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#eaf3fc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay: { fontSize: 13, fontWeight: '900', color: '#0a2f5b' },
  dateMonth: { fontSize: 10, fontWeight: '700', color: '#1566b8' },
  routineName: { fontSize: 13, fontWeight: '800', color: '#0a2f5b' },
  routineNote: { fontSize: 11, color: colors.textMuted },
  daysChip: {
    backgroundColor: '#eaf3fc',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 11,
    fontWeight: '800',
    color: '#1566b8',
    overflow: 'hidden',
  },
  accuracyBig: { fontSize: 28, fontWeight: '900', color: '#0a2f5b' },
  accRow: { gap: 4 },
  accLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  accName: { flex: 1, fontSize: 12, fontWeight: '700', color: '#0a2f5b' },
  accPct: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  weakHint: {
    backgroundColor: '#fff8ee',
    borderRadius: 12,
    padding: 10,
    fontSize: 12,
    color: '#9a5b13',
    overflow: 'hidden',
  },
  askBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#eaf4fc',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#c5dff6',
    padding: 12,
  },
  askIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#1566b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  askTitle: { fontSize: 14, fontWeight: '800', color: '#0a2f5b' },
  offerRow: { gap: 12, paddingRight: spacing.lg },
  offerCard: {
    width: 240,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  offerHeader: {
    height: 72,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  offerPart: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '700',
  },
  offerBody: { padding: 12, gap: 6 },
  offerTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#eaf3fc',
    color: '#1566b8',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  offerTitle: { fontSize: 14, fontWeight: '800', color: '#0a2f5b', minHeight: 36 },
  offerMeta: { fontSize: 11, color: colors.textMuted },
  offerFooter: {
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eef4f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  offerPrice: { fontSize: 14, fontWeight: '800', color: '#0a2f5b' },
  offerCta: {
    borderWidth: 1,
    borderColor: '#1566b8',
    color: '#1566b8',
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '700',
  },
});
