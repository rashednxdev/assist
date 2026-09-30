import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { PerformanceCard } from '@/components/home/PerformanceCard';
import { ExamCountdownCard } from '@/components/home/ExamCountdownCard';
import { ModuleTile } from '@/components/home/ModuleTile';
import { AccessRequiredScreen } from '@/components/home/AccessRequiredScreen';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { useAnswerHistory } from '@/hooks/useAnswerHistory';
import { useModuleOpener } from '@/hooks/useModuleOpener';
import { useAuth } from '@/lib/auth-context';
import { hasLearningModule, isFreeLearningModule, isModuleEffectivelyStopped } from '@/lib/api';
import { fetchProgressDashboard, type ProgressDashboardData } from '@/lib/evaluation-api';
import { getInspirationMessage } from '@/lib/inspiration-message';
import { EXAM_MODULES } from '@/lib/home-modules';
import { colors, spacing } from '@/theme';

export default function ExamPrepScreen() {
  const router = useRouter();
  const { user, canAccess, refreshUser } = useAuth();
  const { items: savedItems } = useSavedShortcuts();
  const { items: historyItems } = useAnswerHistory();
  const { openModule, checkingModuleId, accessScreen, closeAccessScreen } = useModuleOpener();
  const [progress, setProgress] = useState<ProgressDashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const modules = useMemo(() => {
    const grants = user?.module_access ?? [];
    const stops = user?.module_stops ?? [];
    const hasPaidModule = EXAM_MODULES.some((m) => {
      if (isFreeLearningModule(m.code) || m.code === 'QUESTION_EDIT') return false;
      return hasLearningModule(grants, m.code) && !isModuleEffectivelyStopped(stops, grants, m.code) && user?.has_paid !== false;
    });
    if (hasPaidModule) return EXAM_MODULES;
    // Until paid: pin free promo modules at the top — QOTD, then Live class.
    const pinned = ['qotd', 'live'].map((id) => EXAM_MODULES.find((m) => m.id === id)).filter((m) => m != null);
    const pinnedIds = new Set(pinned.map((m) => m.id));
    return [...pinned, ...EXAM_MODULES.filter((m) => !pinnedIds.has(m.id))];
  }, [user?.module_access, user?.module_stops, user?.has_paid]);

  const loadProgress = useCallback(async () => {
    setProgress(await fetchProgressDashboard().catch(() => null));
  }, []);

  useEffect(() => {
    void loadProgress();
  }, [loadProgress]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadProgress(), refreshUser().catch(() => null)]);
    } finally {
      setRefreshing(false);
    }
  }, [loadProgress, refreshUser]);

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <PerformanceCard
          progress={progress}
          savedCount={savedItems.length}
          onSavedPress={() => router.push('/(app)/saved' as Href)}
          onProgressPress={() => router.push('/(app)/progress' as Href)}
        />

        <ExamCountdownCard />

        <Text style={styles.sectionTitle}>Learning modules</Text>
        <View style={styles.grid}>
          {modules.map((m) => {
            const enabled =
              canAccess(m.code) && !isModuleEffectivelyStopped(user?.module_stops ?? [], user?.module_access ?? [], m.code);
            // Question Update is an admin-approved facility, not a default learning module —
            // stay hidden entirely (not just disabled) until access is actually granted.
            if (m.code === 'QUESTION_EDIT' && !enabled) return null;
            const showInspiration = m.code === 'QOTD' || m.code === 'EXAM_WEEK';
            return (
              <ModuleTile
                key={m.id}
                title={m.title}
                subtitle={m.subtitle}
                icon={m.icon}
                color={m.color}
                enabled={enabled}
                checking={checkingModuleId === m.id}
                badgeText={showInspiration ? getInspirationMessage(m.id) : undefined}
                onPress={() => void openModule(m)}
              />
            );
          })}
          <ModuleTile
            title="Answer Reading History"
            subtitle={historyItems.length > 0 ? `${historyItems.length} recently viewed` : 'Recently viewed answers'}
            icon="time-outline"
            color="#4338ca"
            enabled
            onPress={() => router.push('/(app)/history' as Href)}
          />
        </View>

        <Text style={styles.sectionTitle}>Marathon Review</Text>
        <Pressable
          style={({ pressed }) => [styles.card, pressed && styles.pressed]}
          onPress={() => router.push('/(app)/marathon' as Href)}
        >
          <View style={[styles.cardIcon, { backgroundColor: '#0f5c8c' }]}>
            <Text style={styles.cardIconText}>MR</Text>
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>Marathon Review</Text>
            <Text style={styles.cardSub}>Short Questions & Answer on Books & Tools- toggle or hold to reveal answer</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </Pressable>

        {canAccess('USER_QUESTIONS') ? (
          <>
            <Text style={styles.sectionTitle}>Submit a Question</Text>
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push('/(app)/user-questions' as Href)}
            >
              <View style={[styles.cardIcon, { backgroundColor: '#4d7c0f' }]}>
                <Ionicons name="add-circle-outline" size={22} color={colors.white} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.cardTitle}>Can&apos;t find a question?</Text>
                <Text style={styles.cardSub}>Submit it for a subject — an admin will review and answer it</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
            </Pressable>
          </>
        ) : null}
      </ScrollView>

      <AccessRequiredScreen
        visible={accessScreen !== null}
        variant={accessScreen?.variant ?? 'denied'}
        moduleTitle={accessScreen?.moduleTitle}
        stoppedReason={accessScreen?.stoppedReason}
        unpaidMessage={user?.unpaid_message}
        onClose={closeAccessScreen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  scroll: { padding: spacing.lg, gap: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xl * 2 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: { opacity: 0.92 },
  cardIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardIconText: { color: colors.white, fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  cardText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  cardSub: { fontSize: 12, lineHeight: 17, color: colors.textMuted },
});
