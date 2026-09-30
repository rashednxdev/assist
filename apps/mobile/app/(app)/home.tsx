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
  Linking,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ModuleTile } from '@/components/home/ModuleTile';
import { ExamHomeCard } from '@/components/home/ExamHomeCard';
import { HomeSummaryCard } from '@/components/home/HomeSummaryCard';
import { BloodHomeCard } from '@/components/blood/BloodHomeCard';
import { RED } from '@/components/blood/BloodBits';
import { AccessRequiredScreen } from '@/components/home/AccessRequiredScreen';
import { ModuleWelcomeTips } from '@/components/home/ModuleWelcomeTips';
import { APP_UPDATE_URL, APP_VERSION_LABEL } from '@/lib/app-version';
import { isModuleWelcomeTipsPending } from '@/lib/module-welcome-tips';
import { useAuth } from '@/lib/auth-context';
import { useSavedShortcuts } from '@/hooks/useSavedShortcuts';
import { useModuleOpener } from '@/hooks/useModuleOpener';
import { canManageUsers } from '@/lib/users-api';
import { canReadAnyModule } from '@/lib/module-access';
import { CIRCULAR_MODULE_CODES } from '@/lib/circulars-api';
import { POLICY_MODULE_CODES } from '@/lib/policy-api';
import {
  fetchProgressDashboard,
  type ProgressDashboardData,
} from '@/lib/evaluation-api';
import { fetchMyNotifications } from '@/lib/notifications-api';
import { EXAM_MODULES } from '@/lib/home-modules';
import { colors, spacing } from '@/theme';

const QOTD_MODULE = EXAM_MODULES.find((m) => m.code === 'QOTD')!;

const SERVICES: Array<{
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  badgeIcon?: keyof typeof Ionicons.glyphMap;
  color: string;
  href: Href;
}> = [
  {
    id: 'community',
    title: 'Community',
    subtitle: 'Ask, answer & share',
    icon: 'chatbubbles-outline',
    color: '#0f766e',
    href: '/(app)/community' as Href,
  },
  {
    id: 'contacts',
    title: 'Contacts',
    subtitle: 'Offices, colleagues & batchmates',
    icon: 'business-outline',
    badgeIcon: 'call',
    color: '#0d9488',
    href: '/(app)/contacts' as Href,
  },
  {
    id: 'pricing',
    title: 'Pricing',
    subtitle: 'Packages, payments & access',
    icon: 'pricetags-outline',
    color: '#e2136e',
    href: '/(app)/pricing' as Href,
  },
];

const OFFICE_TOOLS: Array<{
  id: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  href: Href;
  /** Shown only to users who can read one of these modules. */
  codes?: string[];
}> = [
  {
    id: 'schedule',
    title: 'Schedule',
    subtitle: 'Meetings, bill dates & R&R',
    icon: 'calendar-outline',
    color: '#4338ca',
    href: '/(app)/schedule' as Href,
  },
  {
    id: 'circulars',
    title: 'Circular archive',
    subtitle: 'Orders, SROs, gazettes & memos',
    icon: 'archive-outline',
    color: '#6d28d9',
    href: '/(app)/circulars' as Href,
    codes: CIRCULAR_MODULE_CODES,
  },
  {
    id: 'policy',
    title: 'Policy library',
    subtitle: 'Acts, rules & circulars by subject',
    icon: 'library-outline',
    color: '#1e40af',
    href: '/(app)/policy' as Href,
    codes: POLICY_MODULE_CODES,
  },
  {
    id: 'ibas',
    title: 'iBAS++ Workspace',
    subtitle: 'Procedures, rules & tools by area',
    icon: 'briefcase-outline',
    color: '#0369a1',
    href: '/(app)/ibas' as Href,
  },
  {
    id: 'toolkit',
    title: 'Checklists & templates',
    subtitle: 'Checklists, fill-in templates & guides',
    icon: 'clipboard-outline',
    color: '#0f766e',
    href: '/(app)/toolkit' as Href,
  },
  {
    id: 'calculations',
    title: 'Salary On 2026 & Calculations',
    subtitle: 'Salary 2026, pension & joining period',
    icon: 'calculator-outline',
    color: '#047857',
    href: '/(app)/calculations' as Href,
  },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, signOut, refreshUser } = useAuth();
  const { items: savedItems } = useSavedShortcuts();
  const { openModule, checkingModuleId, accessScreen, closeAccessScreen } = useModuleOpener();
  const [progress, setProgress] = useState<ProgressDashboardData | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [welcomeTipsOpen, setWelcomeTipsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

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
    setRefreshKey((k) => k + 1);
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
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
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
        <HomeSummaryCard unreadCount={unreadCount} refreshKey={refreshKey} />

        <Text style={styles.sectionTitle}>Office & policy</Text>
        <View style={styles.grid}>
          {OFFICE_TOOLS.filter((s) => !s.codes || canReadAnyModule(user, s.codes)).map((s) => (
            <ModuleTile
              key={s.id}
              title={s.title}
              subtitle={s.subtitle}
              icon={s.icon}
              color={s.color}
              enabled
              onPress={() => router.push(s.href)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Community & services</Text>
        <View style={styles.grid}>
          {SERVICES.map((s) => (
            <ModuleTile
              key={s.id}
              title={s.title}
              subtitle={s.subtitle}
              icon={s.icon}
              badgeIcon={s.badgeIcon}
              color={s.color}
              enabled
              onPress={() => router.push(s.href)}
            />
          ))}
        </View>

        <Text style={styles.sectionTitle}>Blood bank</Text>
        <View>
          <View style={styles.grid}>
            <ModuleTile
              title="Blood Bank"
              subtitle="Blood group, donors, requests & donation history"
              icon="water-outline"
              color={RED}
              enabled
              onPress={() => router.push('/(app)/blood-bank' as Href)}
            />
          </View>
          <BloodHomeCard />
        </View>

        <Text style={styles.sectionTitle}>Exam preparation</Text>
        <ExamHomeCard
          progress={progress}
          savedCount={savedItems.length}
          qotdChecking={checkingModuleId === QOTD_MODULE.id}
          onOpen={() => router.push('/(app)/exam-prep' as Href)}
          onQotd={() => void openModule(QOTD_MODULE)}
        />
      </ScrollView>

      <AccessRequiredScreen
        visible={accessScreen !== null}
        variant={accessScreen?.variant ?? 'denied'}
        moduleTitle={accessScreen?.moduleTitle}
        stoppedReason={accessScreen?.stoppedReason}
        unpaidMessage={user?.unpaid_message}
        onClose={closeAccessScreen}
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
});
