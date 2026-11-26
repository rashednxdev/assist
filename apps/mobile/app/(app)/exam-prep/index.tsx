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
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PreparationSubjectSummary } from '@ibas/shared-types';
import { fetchExamPrepSubjects } from '@/lib/exam-prep-api';
import { accessDate } from '@/lib/billing-api';
import { toBanglaDigits } from '@/lib/bangla-format';
import { colors, spacing } from '@/theme';

const HEADER_TONES = ['#0a2f5b', '#1566b8', '#1f8a96'];

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function EnrolledRow({
  subject,
  index,
  onPress,
}: {
  subject: PreparationSubjectSummary;
  index: number;
  onPress: () => void;
}) {
  const title = subject.name_bn?.trim() || subject.name;
  const accuracy =
    subject.mcq_touched > 0 ? Math.round((subject.mcq_correct / subject.mcq_touched) * 100) : null;

  return (
    <Pressable style={({ pressed }) => [styles.enrolledCard, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.enrolledIcon, { backgroundColor: HEADER_TONES[index % HEADER_TONES.length] }]}>
        <Ionicons name="school" size={22} color="#fff" />
      </View>
      <View style={styles.flex1}>
        <View style={styles.chipRow}>
          <Text style={styles.partChip}>{subject.part_label}</Text>
          <Text style={styles.ownedChip}>এনরোল করা</Text>
          {subject.next_class ? <Text style={styles.liveChip}>সামনে লাইভ ক্লাস</Text> : null}
        </View>
        <Text style={styles.subjectTitle}>{title}</Text>
        {subject.name_bn?.trim() ? <Text style={styles.enName}>{subject.name}</Text> : null}
        <Text style={styles.metaLine}>
          {bn(subject.books)}টি বই · লিখিত {bn(subject.written_read)}/{bn(subject.written)} · MCQ{' '}
          {bn(subject.mcq_touched)}/{bn(subject.mcq)}
          {accuracy !== null ? ` (${bn(accuracy)}%)` : ''} · {bn(subject.papers)}টি বিগত সেট
        </Text>
        <View style={styles.progressRow}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${Math.max(subject.progress_percent, 4)}%` }]} />
          </View>
          <Text style={styles.progressPct}>{bn(subject.progress_percent)}%</Text>
        </View>
        {subject.owned_until ? (
          <Text style={styles.until}>অ্যাক্সেস মেয়াদ: {accessDate(subject.owned_until)}</Text>
        ) : null}
      </View>
      <View style={styles.goBtn}>
        <Text style={styles.goBtnText}>ওয়ার্কস্পেস</Text>
      </View>
    </Pressable>
  );
}

function AvailableCard({
  subject,
  index,
  onPress,
}: {
  subject: PreparationSubjectSummary;
  index: number;
  onPress: () => void;
}) {
  const title = subject.name_bn?.trim() || subject.name;
  const examPkg = subject.packages
    .filter((p) => p.kind === 'exam_prep')
    .sort((a, b) => a.price - b.price)[0];
  const hasLivePkg = subject.packages.some((p) => p.kind === 'live');

  return (
    <Pressable style={({ pressed }) => [styles.availCard, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.availHeader, { backgroundColor: HEADER_TONES[index % HEADER_TONES.length] }]}>
        <View style={styles.chipRow}>
          <Text style={styles.headerChip}>{subject.part_label}</Text>
          {hasLivePkg ? <Text style={styles.headerLive}>লাইভ ক্লাসসহ</Text> : null}
        </View>
        <Ionicons name="book-outline" size={22} color="rgba(255,255,255,0.8)" />
      </View>
      <View style={styles.availBody}>
        <View style={styles.availTop}>
          <Text style={styles.prepTag}>পরীক্ষা প্রস্তুতি</Text>
          <Text style={styles.lockHint}>সারাংশ উন্মুক্ত</Text>
        </View>
        <Text style={styles.availTitle} numberOfLines={2}>
          {title}
        </Text>
        {subject.name_bn?.trim() ? (
          <Text style={styles.enName} numberOfLines={1}>
            {subject.name}
          </Text>
        ) : null}
        <View style={styles.countGrid}>
          {[
            { n: subject.books, l: 'বই' },
            { n: subject.written, l: 'লিখিত' },
            { n: subject.mcq, l: 'MCQ' },
          ].map((c) => (
            <View key={c.l} style={styles.countCell}>
              <Text style={styles.countN}>{bn(c.n)}</Text>
              <Text style={styles.countL}>{c.l}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.metaLine}>
          {bn(subject.papers)}টি বিগত সেট · {bn(subject.past_classes)}টি ক্লাস সম্পন্ন
        </Text>
        <View style={styles.availFooter}>
          <View>
            {examPkg ? (
              <>
                <Text style={styles.price}>
                  {examPkg.price === 0 ? 'ফ্রি' : `৳${examPkg.price.toLocaleString('bn-BD')}`}
                </Text>
                <Text style={styles.until}>
                  {examPkg.whole_part ? 'পূর্ণ পার্ট প্যাকেজ' : 'বিষয়ভিত্তিক প্যাকেজ'}
                </Text>
              </>
            ) : (
              <Text style={styles.until}>রিসোর্স সারাংশ দেখুন</Text>
            )}
          </View>
          <Text style={styles.detailCta}>বিস্তারিত</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function ExamPrepScreen() {
  const router = useRouter();
  const [subjects, setSubjects] = useState<PreparationSubjectSummary[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [partFilter, setPartFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setSubjects(await fetchExamPrepSubjects());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'লোড হয়নি');
      setSubjects([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const parts = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of subjects ?? []) map.set(s.part_id, s.part_label);
    return [...map.entries()].map(([id, label]) => ({ id, label }));
  }, [subjects]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (subjects ?? []).filter((s) => {
      if (partFilter !== 'all' && s.part_id !== partFilter) return false;
      if (!q) return true;
      return (
        s.name.toLowerCase().includes(q) ||
        (s.name_bn ?? '').toLowerCase().includes(q) ||
        s.part_label.toLowerCase().includes(q)
      );
    });
  }, [subjects, partFilter, query]);

  const enrolled = filtered.filter((s) => s.owned);
  const others = filtered.filter((s) => !s.owned);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.flex1}>
            <Text style={styles.h1}>Exam Preparations</Text>
            <Text style={styles.sub}>
              বিষয়ভিত্তিক প্রস্তুতি ওয়ার্কস্পেস — এনরোল করা বিষয়সমূহ সবার উপরে।
            </Text>
          </View>
          <Pressable
            style={styles.packagesBtn}
            onPress={() => router.push('/(app)/pricing?tab=exam_prep' as Href)}
          >
            <Text style={styles.packagesBtnText}>সব কোর্স</Text>
          </Pressable>
        </View>

        <View style={styles.filterCard}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.partRow}>
            <Pressable
              style={[styles.partChipBtn, partFilter === 'all' && styles.partChipBtnOn]}
              onPress={() => setPartFilter('all')}
            >
              <Text style={[styles.partChipBtnText, partFilter === 'all' && styles.partChipBtnTextOn]}>
                সব পার্ট ({bn((subjects ?? []).length)})
              </Text>
            </Pressable>
            {parts.map((p) => (
              <Pressable
                key={p.id}
                style={[styles.partChipBtn, partFilter === p.id && styles.partChipBtnAlt]}
                onPress={() => setPartFilter(p.id)}
              >
                <Text style={[styles.partChipBtnText, partFilter === p.id && styles.partChipBtnTextOn]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="বিষয়ের নাম খুঁজুন..."
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
            />
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!subjects ? (
          <View style={styles.loading}>
            <ActivityIndicator color="#1566b8" />
          </View>
        ) : (
          <>
            {enrolled.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>আপনার এনরোল করা বিষয় · {bn(enrolled.length)}টি</Text>
                {enrolled.map((subject, idx) => (
                  <EnrolledRow
                    key={subject.id}
                    subject={subject}
                    index={idx}
                    onPress={() => router.push(`/(app)/exam-prep/${subject.id}` as Href)}
                  />
                ))}
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyText}>
                  আপনার এখনো কোনো বিষয় এনরোল করা নেই। নিচের যেকোনো বিষয়ে ক্লিক করে রিসোর্স সারাংশ দেখুন এবং
                  প্যাকেজে এনরোল করুন।
                </Text>
              </View>
            )}

            {others.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>
                  {enrolled.length > 0
                    ? `অন্যান্য বিষয়সমূহ · ${bn(others.length)}টি`
                    : `সকল বিষয়সমূহ · ${bn(others.length)}টি`}
                </Text>
                {others.map((subject, idx) => (
                  <AvailableCard
                    key={subject.id}
                    subject={subject}
                    index={idx}
                    onPress={() => router.push(`/(app)/exam-prep/${subject.id}` as Href)}
                  />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl * 2 },
  flex1: { flex: 1, minWidth: 0 },
  pressed: { opacity: 0.92 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  h1: { fontSize: 22, fontWeight: '800', color: '#0a2f5b' },
  sub: { marginTop: 4, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  packagesBtn: {
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  packagesBtnText: { fontSize: 12, fontWeight: '700', color: '#1566b8' },
  filterCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: 12,
    gap: 10,
  },
  partRow: { gap: 8 },
  partChipBtn: {
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: '#f4f9fd',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  partChipBtnOn: { backgroundColor: '#0a2f5b', borderColor: '#0a2f5b' },
  partChipBtnAlt: { backgroundColor: '#1566b8', borderColor: '#1566b8' },
  partChipBtnText: { fontSize: 11, fontWeight: '700', color: '#0a2f5b' },
  partChipBtnTextOn: { color: '#fff' },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: '#f4f9fd',
    borderRadius: 12,
    paddingHorizontal: 10,
    height: 40,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#0a2f5b', paddingVertical: 0 },
  error: {
    backgroundColor: '#fef2f2',
    color: '#b91c1c',
    borderRadius: 12,
    padding: 12,
    fontSize: 13,
    overflow: 'hidden',
  },
  loading: { paddingVertical: 40, alignItems: 'center' },
  section: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0a2f5b' },
  emptyBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#b8d1ea',
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 14,
  },
  emptyText: { fontSize: 13, color: colors.textMuted, lineHeight: 18 },
  enrolledCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: 14,
    alignItems: 'flex-start',
  },
  enrolledIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  partChip: {
    backgroundColor: '#eaf3fc',
    color: '#1566b8',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
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
  liveChip: {
    backgroundColor: '#e6f6f8',
    color: '#0e7490',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  subjectTitle: { marginTop: 6, fontSize: 16, fontWeight: '800', color: '#0a2f5b' },
  enName: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  metaLine: { marginTop: 8, fontSize: 11, color: colors.textMuted, lineHeight: 16 },
  progressRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { flex: 1, height: 8, borderRadius: 999, backgroundColor: '#e6eff7', overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: '#1566b8', borderRadius: 999 },
  progressPct: { fontSize: 11, fontWeight: '800', color: '#0a2f5b' },
  until: { marginTop: 4, fontSize: 10, color: colors.textMuted },
  goBtn: {
    backgroundColor: '#1566b8',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignSelf: 'center',
  },
  goBtnText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  availCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    overflow: 'hidden',
  },
  availHeader: {
    height: 72,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerChip: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    color: '#fff',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  headerLive: {
    backgroundColor: 'rgba(40,184,216,0.25)',
    color: '#9ef0ff',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  availBody: { padding: 14, gap: 6 },
  availTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  prepTag: {
    backgroundColor: '#eaf3fc',
    color: '#1566b8',
    overflow: 'hidden',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 10,
    fontWeight: '700',
  },
  lockHint: { fontSize: 10, color: colors.textMuted },
  availTitle: { fontSize: 15, fontWeight: '800', color: '#0a2f5b' },
  countGrid: {
    marginTop: 6,
    flexDirection: 'row',
    backgroundColor: '#f4f9fd',
    borderRadius: 12,
    padding: 10,
  },
  countCell: { flex: 1, alignItems: 'center' },
  countN: { fontSize: 14, fontWeight: '900', color: '#0a2f5b' },
  countL: { fontSize: 10, color: colors.textMuted, marginTop: 2 },
  availFooter: {
    marginTop: 6,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#eef4f9',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: { fontSize: 16, fontWeight: '900', color: '#0a2f5b' },
  detailCta: {
    borderWidth: 1,
    borderColor: '#1566b8',
    color: '#1566b8',
    overflow: 'hidden',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    fontSize: 11,
    fontWeight: '700',
  },
});
