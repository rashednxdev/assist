import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { PreparationQuizQuestion } from '@ibas/shared-types';
import { upsertQuestionEvaluation } from '@/lib/evaluation-api';
import { toBanglaDigits } from '@/lib/bangla-format';
import { colors, spacing } from '@/theme';

const OPTION_BANGLA_KEYS = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ'];

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function formatTimer(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${bn(String(m).padStart(2, '0'))}:${bn(String(s).padStart(2, '0'))}`;
}

export function ChapterMcqRunner({
  chapterName,
  bookName,
  wrongOnlyMode,
  questions,
  onBack,
  onRetakeAll,
  onRetakeWrong,
  onProgressSaved,
}: {
  chapterName: string;
  bookName?: string;
  wrongOnlyMode: boolean;
  questions: PreparationQuizQuestion[];
  onBack: () => void;
  onRetakeAll: () => void;
  onRetakeWrong: () => void;
  onProgressSaved: () => void;
}) {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [flagged, setFlagged] = useState<Record<string, boolean>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [openExp, setOpenExp] = useState<Record<string, boolean>>({});
  const [submittingAll, setSubmittingAll] = useState(false);

  useEffect(() => {
    setIndex(0);
    setSelected({});
    setFlagged({});
    setSubmitted(false);
    setElapsedSec(0);
    setOpenExp({});
  }, [questions]);

  useEffect(() => {
    if (submitted || questions.length === 0) return;
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [submitted, questions.length]);

  const current = questions[index];

  async function pickOption(questionId: string, optionId: string) {
    setSelected((prev) => ({ ...prev, [questionId]: optionId }));
    setSavingId(questionId);
    try {
      await upsertQuestionEvaluation(questionId, { selected_option_id: optionId });
    } catch {
      // Keep local selection; finish retries
    } finally {
      setSavingId(null);
    }
  }

  async function finishQuiz() {
    setSubmittingAll(true);
    try {
      await Promise.all(
        Object.entries(selected).map(([questionId, optionId]) =>
          upsertQuestionEvaluation(questionId, { selected_option_id: optionId }).catch(() => undefined),
        ),
      );
      onProgressSaved();
    } finally {
      setSubmittingAll(false);
      setSubmitted(true);
    }
  }

  const results = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;
    for (const q of questions) {
      const picked = selected[q.id];
      if (!picked) {
        unanswered += 1;
        continue;
      }
      if (q.correct_option_id && picked === q.correct_option_id) correct += 1;
      else wrong += 1;
    }
    const accuracy = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    return { correct, wrong, unanswered, accuracy };
  }, [questions, selected]);

  if (questions.length === 0) {
    return (
      <View style={styles.emptyCard}>
        <Text style={styles.emptyTitle}>
          {wrongOnlyMode
            ? 'এই অধ্যায়ে কোনো ভুল উত্তর দেওয়া MCQ নেই!'
            : 'এই অধ্যায়ে এখনো কোনো MCQ যুক্ত হয়নি।'}
        </Text>
        <Text style={styles.emptySub}>
          {wrongOnlyMode
            ? 'দারুণ! চাইলে সব প্রশ্ন আবার অনুশীলন করতে পারেন।'
            : 'অন্য অধ্যায় বেছে অনুশীলন শুরু করুন।'}
        </Text>
        <View style={styles.rowGap}>
          {wrongOnlyMode ? (
            <Pressable style={styles.primaryBtn} onPress={onRetakeAll}>
              <Text style={styles.primaryBtnText}>সব প্রশ্ন অনুশীলন করুন</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.secondaryBtn} onPress={onBack}>
            <Text style={styles.secondaryBtnText}>অধ্যায়ের তালিকায় ফিরুন</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (submitted) {
    const mins = Math.max(1, Math.round(elapsedSec / 60));
    return (
      <ScrollView contentContainerStyle={styles.resultsScroll}>
        <Pressable style={styles.backLink} onPress={onBack}>
          <Ionicons name="arrow-back" size={16} color="#1566b8" />
          <Text style={styles.backLinkText}>অধ্যায়ভিত্তিক MCQ › ফলাফল</Text>
        </Pressable>
        <Text style={styles.resultsTitle}>ফলাফল: {chapterName}</Text>
        {bookName ? (
          <View style={styles.bookTitleBanner}>
            <Text style={styles.bookTitleHighlight}>{bookName}</Text>
          </View>
        ) : null}

        <View style={styles.actionRow}>
          {results.wrong > 0 ? (
            <Pressable style={styles.primaryBtn} onPress={onRetakeWrong}>
              <Text style={styles.primaryBtnText}>শুধু ভুল প্রশ্ন ({bn(results.wrong)})</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.outlineBtn} onPress={onRetakeAll}>
            <Text style={styles.outlineBtnText}>আবার সব অনুশীলন</Text>
          </Pressable>
        </View>

        <View style={styles.scoreGrid}>
          {[
            { label: 'স্কোর', value: `${bn(results.correct)}/${bn(questions.length)}`, color: '#0a2f5b' },
            { label: 'সঠিক', value: `${bn(results.accuracy)}%`, color: '#1f9d68' },
            { label: 'ভুল', value: bn(results.wrong), color: '#d9383a' },
            { label: 'সময়', value: `${bn(mins)} মি`, color: '#0a2f5b' },
          ].map((card) => (
            <View key={card.label} style={styles.scoreCard}>
              <Text style={styles.scoreLabel}>{card.label}</Text>
              <Text style={[styles.scoreValue, { color: card.color }]}>{card.value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.reviewCard}>
          <Text style={styles.sectionTitle}>উত্তর পর্যালোচনা</Text>
          {questions.map((q, idx) => {
            const pickedId = selected[q.id];
            const pickedOpt = q.options.find((o) => o.id === pickedId);
            const correctOpt = q.options.find((o) => o.id === q.correct_option_id);
            const isOk = Boolean(pickedId && q.correct_option_id && pickedId === q.correct_option_id);
            const optLabel = (opt?: { id: string; key: string; text: string }) => {
              if (!opt) return 'উত্তর দেওয়া হয়নি';
              const pos = q.options.findIndex((x) => x.id === opt.id);
              const k = OPTION_BANGLA_KEYS[pos] ?? opt.key;
              return `${k}. ${opt.text}`;
            };
            return (
              <View key={q.id} style={styles.reviewItem}>
                <View style={[styles.reviewIcon, isOk ? styles.okBg : styles.badBg]}>
                  <Ionicons
                    name={isOk ? 'checkmark-circle' : 'close-circle'}
                    size={18}
                    color={isOk ? '#1f9d68' : '#d9383a'}
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.reviewQ}>
                    প্রশ্ন {bn(idx + 1)}: {q.title}
                  </Text>
                  <Text style={styles.reviewAns}>
                    আপনার উত্তর:{' '}
                    <Text style={{ color: isOk ? '#1f9d68' : '#d9383a', fontWeight: '700' }}>
                      {optLabel(pickedOpt)}
                    </Text>
                    {correctOpt ? (
                      <>
                        {' · '}সঠিক:{' '}
                        <Text style={{ color: '#1f9d68', fontWeight: '700' }}>{optLabel(correctOpt)}</Text>
                      </>
                    ) : null}
                  </Text>
                  {q.explanation ? (
                    <Pressable onPress={() => setOpenExp((p) => ({ ...p, [q.id]: !p[q.id] }))}>
                      <Text style={styles.link}>{openExp[q.id] ? 'ব্যাখ্যা লুকান' : 'ব্যাখ্যা দেখুন'}</Text>
                    </Pressable>
                  ) : null}
                  {q.explanation && openExp[q.id] ? (
                    <View style={styles.expBox}>
                      <Text style={styles.expText}>{q.explanation}</Text>
                    </View>
                  ) : null}
                  <Pressable onPress={() => router.push(`/(app)/questions/${q.id}` as Href)}>
                    <Text style={styles.mutedLink}>বিস্তারিত পেজ →</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    );
  }

  if (!current) return null;
  const currentPicked = selected[current.id];
  const isFlagged = Boolean(flagged[current.id]);

  return (
    <View style={styles.runnerRoot}>
      <View style={styles.topBar}>
        <View style={styles.flex1}>
          <Pressable style={styles.backLink} onPress={onBack}>
            <Ionicons name="arrow-back" size={16} color={colors.textMuted} />
            <Text style={styles.muted}>ফিরে যান</Text>
          </Pressable>
          <Text style={styles.chapterTag} numberOfLines={1}>
            {wrongOnlyMode ? `${chapterName} · ভুল প্রশ্ন রিটেস্ট` : chapterName}
          </Text>
          <Text style={styles.qCounter}>
            প্রশ্ন {bn(index + 1)} / {bn(questions.length)}
          </Text>
        </View>
        <View style={styles.topActions}>
          <View style={styles.timerPill}>
            <Ionicons name="time-outline" size={14} color="#1566b8" />
            <Text style={styles.timerText}>{formatTimer(elapsedSec)}</Text>
          </View>
          <Pressable
            style={[styles.primaryBtn, styles.compactBtn, submittingAll && styles.disabled]}
            disabled={submittingAll}
            onPress={() => void finishQuiz()}
          >
            {submittingAll ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.primaryBtnText}>জমা দিন</Text>
            )}
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.qScroll}>
        <Text style={styles.qTitle}>{current.title}</Text>
        <View style={styles.options}>
          {current.options.map((opt, optIdx) => {
            const active = currentPicked === opt.id;
            const k = OPTION_BANGLA_KEYS[optIdx] ?? opt.key;
            return (
              <Pressable
                key={opt.id}
                style={[styles.option, active && styles.optionActive]}
                onPress={() => void pickOption(current.id, opt.id)}
              >
                <View style={[styles.optKey, active && styles.optKeyActive]}>
                  <Text style={[styles.optKeyText, active && styles.optKeyTextActive]}>{k}</Text>
                </View>
                <Text style={[styles.optText, active && styles.optTextActive]}>{opt.text}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.navRow}>
          <Pressable
            style={[styles.secondaryBtn, index === 0 && styles.disabled]}
            disabled={index === 0}
            onPress={() => setIndex((i) => Math.max(0, i - 1))}
          >
            <Text style={styles.secondaryBtnText}>আগের</Text>
          </Pressable>
          <Pressable
            style={[styles.flagBtn, isFlagged && styles.flagBtnOn]}
            onPress={() => setFlagged((p) => ({ ...p, [current.id]: !p[current.id] }))}
          >
            <Ionicons name="flag" size={14} color={isFlagged ? '#b45309' : colors.textMuted} />
            <Text style={[styles.flagText, isFlagged && styles.flagTextOn]}>
              {isFlagged ? 'চিহ্নিত' : 'চিহ্নিত রাখুন'}
            </Text>
          </Pressable>
          {index < questions.length - 1 ? (
            <Pressable
              style={styles.navyBtn}
              onPress={() => setIndex((i) => Math.min(questions.length - 1, i + 1))}
            >
              <Text style={styles.primaryBtnText}>পরের</Text>
            </Pressable>
          ) : (
            <Pressable style={styles.primaryBtn} onPress={() => void finishQuiz()}>
              <Text style={styles.primaryBtnText}>ফলাফল দেখুন</Text>
            </Pressable>
          )}
        </View>

        <View style={styles.palette}>
          <Text style={styles.sectionTitle}>প্রশ্ন তালিকা</Text>
          <View style={styles.paletteGrid}>
            {questions.map((q, qIdx) => {
              const isCurrent = qIdx === index;
              const hasAns = Boolean(selected[q.id]);
              const hasFlag = Boolean(flagged[q.id]);
              return (
                <Pressable
                  key={q.id}
                  onPress={() => setIndex(qIdx)}
                  style={[
                    styles.paletteCell,
                    isCurrent && styles.paletteCurrent,
                    !isCurrent && hasFlag && styles.paletteFlag,
                    !isCurrent && !hasFlag && hasAns && styles.paletteAns,
                  ]}
                >
                  <Text
                    style={[
                      styles.paletteText,
                      (isCurrent || (!hasFlag && hasAns)) && styles.paletteTextOn,
                      !isCurrent && hasFlag && styles.paletteTextFlag,
                    ]}
                  >
                    {bn(qIdx + 1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.saveHint}>
            {savingId ? 'উত্তর সংরক্ষণ হচ্ছে…' : 'উত্তর স্বয়ংক্রিয়ভাবে সংরক্ষিত হচ্ছে'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1, minWidth: 0 },
  runnerRoot: { flex: 1, gap: spacing.md },
  emptyCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.lg,
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: '#0a2f5b', textAlign: 'center' },
  emptySub: { fontSize: 13, color: colors.textMuted, textAlign: 'center', lineHeight: 18 },
  rowGap: { gap: spacing.sm, marginTop: spacing.sm },
  resultsScroll: { gap: spacing.md, paddingBottom: spacing.xl },
  backLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  backLinkText: { fontSize: 12, fontWeight: '700', color: '#1566b8' },
  resultsTitle: { fontSize: 20, fontWeight: '800', color: '#0a2f5b' },
  bookTitleBanner: {
    backgroundColor: '#e8f2fc',
    borderLeftWidth: 4,
    borderLeftColor: '#0a2f5b',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 4,
    alignSelf: 'stretch',
  },
  bookTitleHighlight: { fontSize: 14, fontWeight: '800', color: '#0a2f5b' },
  muted: { fontSize: 12, color: colors.textMuted },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  scoreCard: {
    width: '47%',
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.md,
  },
  scoreLabel: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  scoreValue: { marginTop: 4, fontSize: 22, fontWeight: '800' },
  reviewCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#0a2f5b' },
  reviewItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#eef4f9',
  },
  reviewIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  okBg: { backgroundColor: '#e8f8ef' },
  badBg: { backgroundColor: '#fdecec' },
  reviewQ: { fontSize: 13, fontWeight: '800', color: '#0a2f5b', lineHeight: 18 },
  reviewAns: { marginTop: 4, fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  link: { marginTop: 6, fontSize: 12, fontWeight: '700', color: '#1566b8' },
  mutedLink: { marginTop: 4, fontSize: 11, color: colors.textMuted },
  expBox: { marginTop: 6, backgroundColor: '#f4f9fd', borderRadius: 12, padding: 10 },
  expText: { fontSize: 12, lineHeight: 17, color: '#0a2f5b' },
  topBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.md,
  },
  chapterTag: { marginTop: 2, fontSize: 12, fontWeight: '700', color: '#1566b8' },
  qCounter: { marginTop: 2, fontSize: 14, fontWeight: '800', color: '#0a2f5b' },
  topActions: { alignItems: 'flex-end', gap: 8 },
  timerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f4f9fd',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  timerText: { fontSize: 12, fontWeight: '700', color: '#0a2f5b' },
  compactBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  qScroll: { gap: spacing.md, paddingBottom: spacing.xl },
  qTitle: { fontSize: 16, fontWeight: '800', color: '#0a2f5b', lineHeight: 24 },
  options: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#e3edf6',
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionActive: { borderColor: '#1566b8', backgroundColor: '#eaf3fc' },
  optKey: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f4f9fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optKeyActive: { backgroundColor: '#1566b8' },
  optKeyText: { fontSize: 12, fontWeight: '800', color: '#0a2f5b' },
  optKeyTextActive: { color: '#fff' },
  optText: { flex: 1, fontSize: 14, color: '#334155', lineHeight: 20 },
  optTextActive: { fontWeight: '700', color: '#0a2f5b' },
  navRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  primaryBtn: {
    backgroundColor: '#1566b8',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  navyBtn: {
    backgroundColor: '#0a2f5b',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: '#f4f9fd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  secondaryBtnText: { fontSize: 12, fontWeight: '700', color: '#0a2f5b' },
  outlineBtn: {
    borderWidth: 1,
    borderColor: '#1566b8',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  outlineBtnText: { fontSize: 12, fontWeight: '700', color: '#1566b8' },
  flagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 12,
  },
  flagBtnOn: { backgroundColor: '#fff3d6' },
  flagText: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
  flagTextOn: { color: '#b45309' },
  palette: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    padding: spacing.md,
    gap: spacing.sm,
  },
  paletteGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  paletteCell: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d7e4ee',
    backgroundColor: '#f4f9fd',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteCurrent: { backgroundColor: '#0a2f5b', borderColor: '#0a2f5b' },
  paletteAns: { backgroundColor: '#1566b8', borderColor: '#1566b8' },
  paletteFlag: { backgroundColor: '#fff8e6', borderColor: '#f59e0b' },
  paletteText: { fontSize: 12, fontWeight: '800', color: '#0a2f5b' },
  paletteTextOn: { color: '#fff' },
  paletteTextFlag: { color: '#b45309' },
  saveHint: { fontSize: 11, color: '#1566b8' },
  disabled: { opacity: 0.4 },
});
