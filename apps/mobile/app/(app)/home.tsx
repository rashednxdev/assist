import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  Modal,
  Linking,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PerformanceCard } from '@/components/home/PerformanceCard';
import { ModuleTile } from '@/components/home/ModuleTile';
import { ExamCountdownCard } from '@/components/home/ExamCountdownCard';
import { AccessRequiredScreen, type AccessRequiredVariant } from '@/components/home/AccessRequiredScreen';
import { ModuleWelcomeTips } from '@/components/home/ModuleWelcomeTips';
import { APP_UPDATE_URL, APP_VERSION_LABEL } from '@/lib/app-version';
import { isModuleWelcomeTipsPending } from '@/lib/module-welcome-tips';
import { useAuth } from '@/lib/auth-context';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { useAnswerHistory } from '@/hooks/useAnswerHistory';
import { hasLearningModule, findModuleStop, isModuleEffectivelyStopped, isFreeLearningModule } from '@/lib/api';
import { canManageUsers } from '@/lib/users-api';
import {
  fetchProgressDashboard,
  type ProgressDashboardData,
} from '@/lib/evaluation-api';
import { fetchMyNotifications } from '@/lib/notifications-api';
import { qotdColors } from '@/lib/qotd-theme';
import { examWeekColors } from '@/lib/exam-week-theme';
import { getInspirationMessage } from '@/lib/inspiration-message';
import { colors, spacing } from '@/theme';

const MODULES: Array<{
  id: string;
  code:
    | 'BOOKS'
    | 'QUESTIONS'
    | 'EXAM'
    | 'PAPER'
    | 'PENSION'
    | 'QUESTION_EDIT'
    | 'QOTD'
    | 'EXAM_ROUTINE'
    | 'EXAM_WEEK';
  title: string;
  subtitle: string;
  icon:
    | 'library-outline'
    | 'list-outline'
    | 'school-outline'
    | 'document-text-outline'
    | 'calculator-outline'
    | 'create-outline'
    | 'calendar-outline'
    | 'time-outline'
    | 'trophy-outline';
  color: string;
  href: Href;
}> = [
  {
    id: 'books',
    code: 'BOOKS' as const,
    title: 'Books & Tools',
    subtitle: 'Books & regulatory tools',
    icon: 'library-outline' as const,
    color: '#0f5c8c',
    href: '/(app)/books',
  },
  {
    id: 'paper',
    code: 'PAPER' as const,
    title: 'Exam Papers',
    subtitle: 'Session-wise model papers',
    icon: 'document-text-outline' as const,
    color: '#d97706',
    href: '/(app)/papers',
  },
  {
    id: 'exam',
    code: 'EXAM' as const,
    title: 'Exam Programs',
    subtitle: 'SAS, SRAS & exam structure',
    icon: 'school-outline' as const,
    color: '#059669',
    href: '/(app)/exams',
  },
  {
    id: 'questions',
    code: 'QUESTIONS' as const,
    title: 'Question Bank',
    subtitle: 'Browse & practice questions',
    icon: 'list-outline' as const,
    color: '#7c3aed',
    href: '/(app)/questions',
  },
  {
    id: 'qotd',
    code: 'QOTD' as const,
    title: 'Questions of the Day',
    subtitle: 'Daily subject-wise questions',
    icon: 'calendar-outline' as const,
    color: qotdColors.accent,
    href: '/(app)/qotd' as Href,
  },
  {
    id: 'exam-week',
    code: 'EXAM_WEEK' as const,
    title: 'Exams of the Week',
    subtitle: 'Featured exam papers, by week',
    icon: 'trophy-outline' as const,
    color: examWeekColors.accent,
    href: '/(app)/exam-week' as Href,
  },
  {
    id: 'pension',
    code: 'PENSION' as const,
    title: 'Pension Calculator',
    subtitle: 'Leave math & lamp grant',
    icon: 'calculator-outline' as const,
    color: '#0e7490',
    href: '/(app)/pension' as Href,
  },
  {
    id: 'joining-period',
    code: 'PENSION' as const,
    title: 'Joining Period',
    subtitle: 'Prep + travel math',
    icon: 'calculator-outline' as const,
    color: '#0369a1',
    href: '/(app)/joining-period' as Href,
  },
  {
    id: 'exam-routine',
    code: 'EXAM_ROUTINE' as const,
    title: 'Exam Routine',
    subtitle: 'Schedules, countdown & instructions',
    icon: 'time-outline' as const,
    color: '#7c2d12',
    href: '/(app)/exam-routine' as Href,
  },
  {
    id: 'question-update',
    code: 'QUESTION_EDIT' as const,
    title: 'Question Update',
    subtitle: 'Review & edit questions and answers',
    icon: 'create-outline' as const,
    color: '#B45309',
    href: '/(app)/question-update' as Href,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut, canAccess, refreshUser } = useAuth();
  const { items: savedItems } = useSavedShortcuts();
  const { items: historyItems } = useAnswerHistory();
  const [progress, setProgress] = useState<ProgressDashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingModuleId, setCheckingModuleId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [welcomeTipsOpen, setWelcomeTipsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [accessScreen, setAccessScreen] = useState<{
    variant: AccessRequiredVariant;
    moduleTitle?: string;
    stoppedReason?: string;
  } | null>(null);

  const homeModules = useMemo(() => {
    const grants = user?.module_access ?? [];
    const stops = user?.module_stops ?? [];
    const hasPaidModule = MODULES.some((m) => {
      if (isFreeLearningModule(m.code) || m.code === 'QUESTION_EDIT') return false;
      return (
        hasLearningModule(grants, m.code) &&
        !isModuleEffectivelyStopped(stops, grants, m.code) &&
        user?.has_paid !== false
      );
    });
    if (hasPaidModule) return MODULES;
    const qotd = MODULES.find((m) => m.code === 'QOTD');
    if (!qotd) return MODULES;
    return [qotd, ...MODULES.filter((m) => m.id !== qotd.id)];
  }, [user?.module_access, user?.module_stops, user?.has_paid]);

  const openModule = useCallback(
    async (module: (typeof MODULES)[number]) => {
      if (isModuleEffectivelyStopped(user?.module_stops ?? [], user?.module_access ?? [], module.code)) {
        const stop = findModuleStop(user?.module_stops ?? [], module.code);
        setAccessScreen({
          variant: 'stopped',
          moduleTitle: module.title,
          stoppedReason: stop?.stopped_reason,
        });
        return;
      }

      if (isFreeLearningModule(module.code)) {
        router.push(module.href);
        return;
      }

      if (user && user.has_paid === false) {
        setAccessScreen({ variant: 'unpaid', moduleTitle: module.title });
        return;
      }

      if (hasLearningModule(user?.module_access ?? [], module.code)) {
        router.push(module.href);
        return;
      }

      setCheckingModuleId(module.id);
      try {
        const me = await refreshUser();
        if (isModuleEffectivelyStopped(me.module_stops ?? [], me.module_access ?? [], module.code)) {
          const freshStop = findModuleStop(me.module_stops ?? [], module.code);
          setAccessScreen({
            variant: 'stopped',
            moduleTitle: module.title,
            stoppedReason: freshStop?.stopped_reason,
          });
          return;
        }
        if (isFreeLearningModule(module.code)) {
          router.push(module.href);
          return;
        }
        if (me.has_paid === false) {
          setAccessScreen({ variant: 'unpaid', moduleTitle: module.title });
          return;
        }
        if (hasLearningModule(me.module_access ?? [], module.code)) {
          router.push(module.href);
          return;
        }
        setAccessScreen({ variant: 'denied', moduleTitle: module.title });
      } catch {
        setAccessScreen({ variant: 'network-error' });
      } finally {
        setCheckingModuleId(null);
      }
    },
    [refreshUser, router, user],
  );

  const loadData = useCallback(async () => {
    const dash = await fetchProgressDashboard().catch(() => null);
    setProgress(dash);
  }, []);

  const loadUnreadCount = useCallback(async () => {
    const res = await fetchMyNotifications(true).catch(() => null);
    setUnreadCount(res?.meta.unread_count ?? 0);
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([loadData(), refreshUser().catch(() => null)]);
    } finally {
      setRefreshing(false);
    }
  }, [loadData, refreshUser]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    void isModuleWelcomeTipsPending().then((pending) => {
      if (pending) setWelcomeTipsOpen(true);
    });
  }, []);

  // Module grants can change while the app stays open (e.g. an admin grants/revokes access) —
  // re-check on every visit to home, not just at login, so tile visibility stays current.
  useFocusEffect(
    useCallback(() => {
      void refreshUser().catch(() => {});
      void loadUnreadCount();
    }, [refreshUser, loadUnreadCount]),
  );

  function confirmSignOut() {
    setMenuOpen(false);
    Alert.alert('Sign out?', 'You will need to sign in again to continue.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.primaryDark, colors.primary]} style={styles.hero}>
        <SafeAreaView edges={['top']}>
          <View style={styles.heroInner}>
            <View>
              <Text style={styles.greet}>ProAssist</Text>
              <Text style={styles.heroSub}>Level up your services</Text>
            </View>
            <View style={styles.heroActions}>
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
              <Pressable
                onPress={() => setMenuOpen(true)}
                style={styles.menuBtn}
                accessibilityLabel="Open menu"
                hitSlop={8}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.white} />
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </LinearGradient>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setMenuOpen(false)} />
          <SafeAreaView edges={['top']} style={styles.menuSafe} pointerEvents="box-none">
            <View style={styles.menuCard}>
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/(app)/profile' as Href);
                }}
              >
                <Ionicons name="person-outline" size={20} color={colors.primary} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Profile</Text>
                  <Text style={styles.menuItemSub}>Account & access details</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
              <View style={styles.menuDivider} />
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={() => {
                  setMenuOpen(false);
                  router.push('/(app)/progress' as Href);
                }}
              >
                <Ionicons name="stats-chart-outline" size={20} color={colors.primary} />
                <View style={styles.menuItemText}>
                  <Text style={styles.menuItemTitle}>Progress Dashboard</Text>
                  <Text style={styles.menuItemSub}>Papers & MCQ results</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
              {canManageUsers(user) ? (
                <>
                  <View style={styles.menuDivider} />
                  <Pressable
                    style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                    onPress={() => {
                      setMenuOpen(false);
                      router.push('/(app)/users' as Href);
                    }}
                  >
                    <Ionicons name="people-outline" size={20} color={colors.primary} />
                    <View style={styles.menuItemText}>
                      <Text style={styles.menuItemTitle}>Users</Text>
                      <Text style={styles.menuItemSub}>Manage users, module access & notify</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                  </Pressable>
                </>
              ) : null}
              <View style={styles.menuDivider} />
              <Pressable
                style={({ pressed }) => [styles.menuItem, pressed && styles.menuItemPressed]}
                onPress={confirmSignOut}
              >
                <Ionicons name="log-out-outline" size={20} color={colors.error} />
                <View style={styles.menuItemText}>
                  <Text style={[styles.menuItemTitle, styles.menuItemDanger]}>Sign out</Text>
                  <Text style={styles.menuItemSub}>End this session</Text>
                </View>
              </Pressable>
              <View style={styles.menuDivider} />
              <View style={styles.menuVersion}>
                <Text style={styles.menuVersionText}>{APP_VERSION_LABEL}</Text>
                <Pressable
                  style={({ pressed }) => [styles.updateBtn, pressed && styles.updateBtnPressed]}
                  onPress={() => {
                    setMenuOpen(false);
                    void Linking.openURL(APP_UPDATE_URL);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Check update"
                >
                  <Ionicons name="cloud-download-outline" size={14} color={colors.primary} />
                  <Text style={styles.updateBtnText}>Check update</Text>
                </Pressable>
              </View>
            </View>
          </SafeAreaView>
        </View>
      </Modal>

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
          {homeModules.map((m) => {
            const enabled =
              canAccess(m.code) &&
              !isModuleEffectivelyStopped(user?.module_stops ?? [], user?.module_access ?? [], m.code);
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
            subtitle={
              historyItems.length > 0
                ? `${historyItems.length} recently viewed`
                : 'Recently viewed answers'
            }
            icon="time-outline"
            color="#4338ca"
            enabled
            onPress={() => router.push('/(app)/history' as Href)}
          />
        </View>

        <Text style={styles.sectionTitle}>Marathon Review</Text>
        <Pressable
          style={({ pressed }) => [styles.marathonCard, pressed && styles.marathonCardPressed]}
          onPress={() => router.push('/(app)/marathon' as Href)}
        >
          <View style={styles.marathonIcon}>
            <Text style={styles.marathonIconText}>MR</Text>
          </View>
          <View style={styles.marathonText}>
            <Text style={styles.marathonTitle}>Marathon Review</Text>
            <Text style={styles.marathonSub}>
              Short Questions & Answer on Books & Tools- toggle or hold to reveal answer
            </Text>
          </View>
          <Text style={styles.marathonChevron}>›</Text>
        </Pressable>

        {canAccess('USER_QUESTIONS') && (
          <>
            <Text style={styles.sectionTitle}>Submit a Question</Text>
            <Pressable
              style={({ pressed }) => [styles.submitQCard, pressed && styles.marathonCardPressed]}
              onPress={() => router.push('/(app)/user-questions' as Href)}
            >
              <View style={styles.submitQIcon}>
                <Ionicons name="add-circle-outline" size={22} color={colors.white} />
              </View>
              <View style={styles.marathonText}>
                <Text style={styles.marathonTitle}>Can&apos;t find a question?</Text>
                <Text style={styles.marathonSub}>
                  Submit it for a subject — an admin will review and answer it
                </Text>
              </View>
              <Text style={styles.marathonChevron}>›</Text>
            </Pressable>
          </>
        )}

      </ScrollView>

      <AccessRequiredScreen
        visible={accessScreen !== null}
        variant={accessScreen?.variant ?? 'denied'}
        moduleTitle={accessScreen?.moduleTitle}
        stoppedReason={accessScreen?.stoppedReason}
        onClose={() => setAccessScreen(null)}
      />
      <ModuleWelcomeTips visible={welcomeTipsOpen} onDone={() => setWelcomeTipsOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  hero: {
    paddingBottom: spacing.lg,
  },
  heroInner: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greet: {
    color: colors.white,
    fontSize: 24,
    fontWeight: '800',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 2,
  },
  heroActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
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
    borderColor: colors.primaryDark,
  },
  badgeText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: '800',
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  menuSafe: {
    alignItems: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  menuCard: {
    width: 260,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: 52,
    shadowColor: '#0f172a',
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  menuItemPressed: {
    backgroundColor: colors.background,
  },
  menuItemText: {
    flex: 1,
    gap: 2,
  },
  menuItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  menuItemDanger: {
    color: colors.error,
  },
  menuItemSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  menuDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
  menuVersion: {
    paddingHorizontal: spacing.md,
    paddingTop: 10,
    paddingBottom: 12,
    alignItems: 'center',
    gap: 8,
  },
  menuVersionText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
    color: colors.textMuted,
  },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: '#eff6ff',
    paddingVertical: 8,
  },
  updateBtnPressed: {
    opacity: 0.85,
  },
  updateBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.primary,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingTop: spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  marathonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  marathonCardPressed: {
    opacity: 0.92,
  },
  submitQCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  submitQIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#4d7c0f',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marathonIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#0f5c8c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  marathonIconText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  marathonText: {
    flex: 1,
    gap: 2,
  },
  marathonTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  marathonSub: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  marathonChevron: {
    fontSize: 28,
    color: colors.textMuted,
    fontWeight: '300',
    marginTop: -2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
