import { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  Modal,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { PerformanceCard } from '@/components/home/PerformanceCard';
import { ModuleTile } from '@/components/home/ModuleTile';
import { useAuth } from '@/lib/auth-context';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { hasLearningModule, type LearningModuleCode } from '@/lib/api';
import {
  fetchProgressDashboard,
  type ProgressDashboardData,
} from '@/lib/evaluation-api';
import { colors, spacing } from '@/theme';

const MODULES: Array<{
  id: string;
  code: 'BOOKS' | 'QUESTIONS' | 'EXAM' | 'PAPER' | 'PENSION';
  title: string;
  subtitle: string;
  icon: 'library-outline' | 'help-circle-outline' | 'school-outline' | 'document-text-outline' | 'calculator-outline';
  color: string;
  href: Href;
}> = [
  {
    id: 'books',
    code: 'BOOKS' as const,
    title: 'Books and Tools',
    subtitle: 'Books & regulatory tools',
    icon: 'library-outline' as const,
    color: '#0f5c8c',
    href: '/(app)/books',
  },
  {
    id: 'questions',
    code: 'QUESTIONS' as const,
    title: 'Question Bank',
    subtitle: 'Browse & practice questions',
    icon: 'help-circle-outline' as const,
    color: '#7c3aed',
    href: '/(app)/questions',
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
    id: 'paper',
    code: 'PAPER' as const,
    title: 'Practice Papers',
    subtitle: 'Session-wise model papers',
    icon: 'document-text-outline' as const,
    color: '#d97706',
    href: '/(app)/papers',
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
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut, canAccess, refreshUser } = useAuth();
  const { items: savedItems } = useSavedShortcuts();
  const [progress, setProgress] = useState<ProgressDashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [checkingModuleId, setCheckingModuleId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const moduleAllowed = useCallback(
    (grants: Parameters<typeof hasLearningModule>[0], code: LearningModuleCode) => {
      if (code === 'BOOKS') {
        return hasLearningModule(grants, 'BOOKS') || hasLearningModule(grants, 'OCR');
      }
      return hasLearningModule(grants, code);
    },
    [],
  );

  const openModule = useCallback(
    async (module: (typeof MODULES)[number]) => {
      if (moduleAllowed(user?.module_access ?? [], module.code)) {
        router.push(module.href);
        return;
      }

      setCheckingModuleId(module.id);
      try {
        const me = await refreshUser();
        if (moduleAllowed(me.module_access ?? [], module.code)) {
          router.push(module.href);
          return;
        }
        Alert.alert(
          'Access required',
          `${module.title} is not granted for your account yet. Ask an admin to enable module access.`,
        );
      } catch {
        Alert.alert('Could not verify access', 'Check your connection and try again.');
      } finally {
        setCheckingModuleId(null);
      }
    },
    [moduleAllowed, refreshUser, router, user?.module_access],
  );

  const loadData = useCallback(async () => {
    const dash = await fetchProgressDashboard().catch(() => null);
    setProgress(dash);
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
              <Text style={styles.heroSub}>Preparation Dashboard</Text>
            </View>
            <Pressable
              onPress={() => setMenuOpen(true)}
              style={styles.menuBtn}
              accessibilityLabel="Open menu"
              hitSlop={8}
            >
              <Ionicons name="ellipsis-vertical" size={20} color={colors.white} />
            </Pressable>
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

        <Text style={styles.sectionTitle}>Learning modules</Text>
        <View style={styles.grid}>
          {MODULES.map((m) => {
            const enabled =
              m.code === 'BOOKS' ? canAccess('BOOKS') || canAccess('OCR') : canAccess(m.code);
            return (
              <ModuleTile
                key={m.id}
                title={m.title}
                subtitle={m.subtitle}
                icon={m.icon}
                color={m.color}
                enabled={enabled}
                checking={checkingModuleId === m.id}
                onPress={() => void openModule(m)}
              />
            );
          })}
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

        <Text style={styles.note}>
          This app includes User account features and Learning modules only. More screens will be
          added in the next phase.
        </Text>
      </ScrollView>
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
  menuBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
  note: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
});
