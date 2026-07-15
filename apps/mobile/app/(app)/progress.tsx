import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import {
  fetchProgressDashboard,
  type ProgressDashboardData,
} from '@/lib/evaluation-api';
import { colors, spacing } from '@/theme';

function RingStat({
  value,
  label,
  tone = 'primary',
}: {
  value: string;
  label: string;
  tone?: 'primary' | 'success' | 'warning' | 'error';
}) {
  const border =
    tone === 'success'
      ? colors.success
      : tone === 'warning'
        ? colors.warning
        : tone === 'error'
          ? colors.error
          : colors.primary;

  return (
    <View style={[styles.ring, { borderColor: border }]}>
      <Text style={[styles.ringValue, { color: border }]}>{value}</Text>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

function ProgressBar({ percent, color = colors.primary }: { percent: number; color?: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <View style={styles.barTrack}>
      <View style={[styles.barFill, { width: `${clamped}%`, backgroundColor: color }]} />
    </View>
  );
}

export default function ProgressDashboardScreen() {
  const router = useRouter();
  const [data, setData] = useState<ProgressDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const next = await fetchProgressDashboard();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load progress');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  return (
    <View style={styles.root}>
      {loading && !data ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error && !data ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : data ? (
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
          <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.heroCard}>
            <Text style={styles.heroEyebrow}>Your learning pulse</Text>
            <Text style={styles.heroTitle}>Submitted answers & paper progress</Text>
            <Text style={styles.heroSub}>
              Only evaluations you have submitted are counted here.
            </Text>
            <View style={styles.heroStats}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{data.mcq.submitted}</Text>
                <Text style={styles.heroStatLabel}>MCQs answered</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{data.papers.attempted}</Text>
                <Text style={styles.heroStatLabel}>Papers started</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{data.mcq.accuracy_percent}%</Text>
                <Text style={styles.heroStatLabel}>MCQ accuracy</Text>
              </View>
            </View>
          </LinearGradient>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: '#ede9fe' }]}>
                <Ionicons name="help-circle" size={20} color="#7c3aed" />
              </View>
              <View style={styles.sectionHeadText}>
                <Text style={styles.sectionTitle}>Evaluate MCQ</Text>
                <Text style={styles.sectionSub}>Based on answers you submitted</Text>
              </View>
            </View>

            <View style={styles.ringRow}>
              <RingStat value={String(data.mcq.submitted)} label="Submitted" />
              <RingStat value={String(data.mcq.correct)} label="Correct" tone="success" />
              <RingStat value={String(data.mcq.incorrect)} label="Wrong" tone="error" />
            </View>

            <View style={styles.accuracyCard}>
              <View style={styles.accuracyTop}>
                <Text style={styles.accuracyLabel}>Accuracy</Text>
                <Text style={styles.accuracyValue}>{data.mcq.accuracy_percent}%</Text>
              </View>
              <ProgressBar
                percent={data.mcq.accuracy_percent}
                color={data.mcq.accuracy_percent >= 70 ? colors.success : colors.warning}
              />
              {data.mcq.submitted === 0 ? (
                <Text style={styles.emptyHint}>Submit MCQ answers in Question Bank or Papers to see results.</Text>
              ) : (
                <Text style={styles.emptyHint}>
                  {data.mcq.correct} correct out of {data.mcq.submitted} submitted
                </Text>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={[styles.sectionIcon, { backgroundColor: '#ffedd5' }]}>
                <Ionicons name="document-text" size={20} color="#d97706" />
              </View>
              <View style={styles.sectionHeadText}>
                <Text style={styles.sectionTitle}>Practice papers</Text>
                <Text style={styles.sectionSub}>
                  Papers where you rated or answered questions
                </Text>
              </View>
            </View>

            <View style={styles.paperSummaryRow}>
              <View style={styles.paperSummaryCell}>
                <Text style={styles.paperSummaryValue}>{data.papers.average_progress_percent}%</Text>
                <Text style={styles.paperSummaryLabel}>Avg progress</Text>
              </View>
              <View style={styles.paperSummaryCell}>
                <Text style={styles.paperSummaryValue}>
                  {data.papers.rated_questions}/{data.papers.total_questions || 0}
                </Text>
                <Text style={styles.paperSummaryLabel}>Questions done</Text>
              </View>
            </View>

            {data.papers.items.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>No paper progress yet</Text>
                <Text style={styles.emptyHint}>
                  Open Practice Papers and submit evaluations to track progress here.
                </Text>
                <Pressable
                  style={styles.ctaBtn}
                  onPress={() => router.push('/(app)/papers')}
                >
                  <Text style={styles.ctaText}>Go to Practice Papers</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.paperList}>
                {data.papers.items.map((paper) => (
                  <Pressable
                    key={paper.id}
                    style={({ pressed }) => [styles.paperCard, pressed && styles.paperCardPressed]}
                    onPress={() => router.push(`/(app)/papers/${paper.id}`)}
                  >
                    <View style={styles.paperCardTop}>
                      <View style={styles.paperCardBody}>
                        <Text style={styles.paperName} numberOfLines={2}>
                          {paper.name}
                        </Text>
                        {paper.session_year ? (
                          <Text style={styles.paperMeta}>Session {paper.session_year}</Text>
                        ) : null}
                      </View>
                      <View style={styles.percentBadge}>
                        <Text style={styles.percentBadgeText}>{paper.progress_percent}%</Text>
                      </View>
                    </View>
                    <ProgressBar percent={paper.progress_percent} color="#d97706" />
                    <Text style={styles.paperMeta}>
                      {paper.rated_questions}/{paper.total_questions} evaluated · pass {paper.pass_marks}/
                      {paper.total_marks}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },
  heroCard: {
    borderRadius: 24,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
    lineHeight: 28,
  },
  heroSub: {
    color: 'rgba(255,255,255,0.82)',
    fontSize: 13,
    lineHeight: 18,
  },
  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 16,
    paddingVertical: spacing.md,
  },
  heroStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  heroStatValue: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '800',
  },
  heroStatLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    fontWeight: '600',
  },
  heroDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  section: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeadText: {
    flex: 1,
    gap: 2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  sectionSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  ringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  ring: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: 104,
    borderRadius: 999,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    alignSelf: 'center',
  },
  ringValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  ringLabel: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  accuracyCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
    gap: 8,
  },
  accuracyTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accuracyLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  accuracyValue: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  barTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  barFill: {
    height: 10,
    borderRadius: 999,
  },
  paperSummaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  paperSummaryCell: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
  },
  paperSummaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  paperSummaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  paperList: {
    gap: spacing.sm,
  },
  paperCard: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.md,
    gap: 8,
  },
  paperCardPressed: {
    opacity: 0.92,
  },
  paperCardTop: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  paperCardBody: {
    flex: 1,
    gap: 2,
  },
  paperName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  paperMeta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  percentBadge: {
    backgroundColor: '#ffedd5',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  percentBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#c2410c',
  },
  emptyBox: {
    backgroundColor: colors.background,
    borderRadius: 14,
    padding: spacing.lg,
    gap: spacing.sm,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  emptyHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
  },
  ctaBtn: {
    marginTop: 4,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  ctaText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: 13,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: {
    color: colors.white,
    fontWeight: '700',
  },
});
