import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AccessRequiredScreen } from '@/components/home/AccessRequiredScreen';
import { useModuleOpener } from '@/hooks/useModuleOpener';
import { useAuth } from '@/lib/auth-context';
import {
  APP_ADMIN_NAV,
  APP_PRIMARY_NAV,
  APP_TOOLS_NAV,
  pathIsActive,
  type AppNavItem,
} from '@/lib/app-nav';
import { APP_UPDATE_URL, APP_VERSION_LABEL } from '@/lib/app-version';
import { EXAM_MODULES, type GatedModule } from '@/lib/home-modules';
import { hasLearningModule } from '@/lib/api';
import { isPlatformAdminUser } from '@/lib/module-access';
import { canManageUsers } from '@/lib/users-api';
import { colors, spacing } from '@/theme';

const DRAWER_WIDTH = Math.min(304, Dimensions.get('window').width * 0.82);

interface AppMenuContextValue {
  openMenu: () => void;
  closeMenu: () => void;
  toggleMenu: () => void;
  menuOpen: boolean;
}

const AppMenuContext = createContext<AppMenuContextValue | null>(null);

export function useAppMenu(): AppMenuContextValue {
  const ctx = useContext(AppMenuContext);
  if (!ctx) {
    throw new Error('useAppMenu must be used within AppMenuProvider');
  }
  return ctx;
}

/** Safe hook for optional menu trigger outside provider (returns null). */
export function useAppMenuOptional(): AppMenuContextValue | null {
  return useContext(AppMenuContext);
}

function gatedModuleFor(item: AppNavItem): GatedModule | undefined {
  if (!item.moduleCode) return undefined;
  const found = EXAM_MODULES.find((m) => m.code === item.moduleCode);
  if (found) return found;
  return {
    id: item.id,
    code: item.moduleCode,
    title: item.label,
    subtitle: item.label,
    icon: item.icon,
    color: '#1566b8',
    href: item.href,
  };
}

function NavRow({
  item,
  active,
  onPress,
}: {
  item: AppNavItem;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.navRow,
        active && styles.navRowActive,
        pressed && !active && styles.navRowPressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      <Ionicons name={item.icon} size={18} color={active ? '#fff' : 'rgba(255,255,255,0.85)'} />
      <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>
        {item.label}
      </Text>
    </Pressable>
  );
}

function AppMenuDrawer({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const { openModule, accessScreen, closeAccessScreen } = useModuleOpener();
  const [toolsOpen, setToolsOpen] = useState(true);
  const slide = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      slide.setValue(-DRAWER_WIDTH);
      fade.setValue(0);
    }
  }, [visible, slide, fade]);

  const adminItems = useMemo(() => {
    const grants = user?.module_access ?? [];
    return APP_ADMIN_NAV.filter((item) => {
      if (item.adminOnly && !isPlatformAdminUser(user)) return false;
      if (item.usersManageOnly && !canManageUsers(user) && !isPlatformAdminUser(user)) return false;
      // Question Update: same as before — only for QUESTION_EDIT grant or platform admin.
      if (item.moduleCode === 'QUESTION_EDIT') {
        return isPlatformAdminUser(user) || hasLearningModule(grants, 'QUESTION_EDIT');
      }
      return true;
    });
  }, [user]);

  async function navigate(item: AppNavItem) {
    onClose();
    // Admin Question Update is grant-gated in the menu filter; open the same editor flow directly.
    if (item.id === 'question-update') {
      router.push(item.href);
      return;
    }
    const gated = gatedModuleFor(item);
    if (gated) {
      await openModule(gated);
      return;
    }
    router.push(item.href);
  }

  function confirmSignOut() {
    onClose();
    Alert.alert('Sign out?', 'You will need to sign in again to continue.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }

  const name =
    user?.full_name_bn?.trim() || user?.full_name_en?.trim() || user?.email || 'Learner';

  return (
    <>
      <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
        <View style={styles.modalRoot}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close menu"
          >
            <Animated.View
              pointerEvents="none"
              style={[styles.backdrop, { opacity: fade }]}
            />
          </Pressable>
          <Animated.View style={[styles.drawer, { transform: [{ translateX: slide }] }]}>
            <SafeAreaView edges={['top', 'bottom']} style={styles.drawerInner}>
              <View style={styles.brandRow}>
                <View style={styles.brandMark}>
                  <Text style={styles.brandMarkText}>P</Text>
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.brandTitle}>ProAssist</Text>
                  <Text style={styles.brandSub} numberOfLines={1}>
                    {name}
                  </Text>
                </View>
                <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color="rgba(255,255,255,0.9)" />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.navScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.sectionLabel}>Menu</Text>
                {APP_PRIMARY_NAV.map((item) => (
                  <NavRow
                    key={item.id}
                    item={item}
                    active={pathIsActive(pathname, item)}
                    onPress={() => void navigate(item)}
                  />
                ))}

                <Pressable
                  style={styles.toolsToggle}
                  onPress={() => setToolsOpen((v) => !v)}
                >
                  <Text style={styles.sectionLabel}>More tools</Text>
                  <Ionicons
                    name={toolsOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color="rgba(255,255,255,0.7)"
                  />
                </Pressable>
                {toolsOpen
                  ? APP_TOOLS_NAV.map((item) => (
                      <NavRow
                        key={item.id}
                        item={item}
                        active={pathIsActive(pathname, item)}
                        onPress={() => void navigate(item)}
                      />
                    ))
                  : null}

                {adminItems.length > 0 ? (
                  <>
                    <Text style={styles.sectionLabel}>Administration</Text>
                    {adminItems.map((item) => (
                      <NavRow
                        key={item.id}
                        item={item}
                        active={pathIsActive(pathname, item)}
                        onPress={() => void navigate(item)}
                      />
                    ))}
                  </>
                ) : null}
              </ScrollView>

              <View style={styles.footer}>
                <Text style={styles.version}>{APP_VERSION_LABEL}</Text>
                <Pressable
                  style={styles.updateBtn}
                  onPress={() => {
                    onClose();
                    void Linking.openURL(APP_UPDATE_URL);
                  }}
                >
                  <Ionicons name="cloud-download-outline" size={14} color="#fff" />
                  <Text style={styles.updateText}>Check update</Text>
                </Pressable>
                <Pressable style={styles.signOutBtn} onPress={confirmSignOut}>
                  <Ionicons name="log-out-outline" size={16} color="#fecaca" />
                  <Text style={styles.signOutText}>Sign out</Text>
                </Pressable>
              </View>
            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      <AccessRequiredScreen
        visible={accessScreen !== null}
        variant={accessScreen?.variant ?? 'denied'}
        moduleTitle={accessScreen?.moduleTitle}
        stoppedReason={accessScreen?.stoppedReason}
        unpaidMessage={user?.unpaid_message}
        onClose={closeAccessScreen}
      />
    </>
  );
}

/** Web-like hamburger — use in headers or home hero. */
export function MenuTriggerButton({
  light = true,
  size = 40,
}: {
  light?: boolean;
  size?: number;
}) {
  const menu = useAppMenuOptional();
  if (!menu) return null;
  return (
    <Pressable
      onPress={menu.openMenu}
      style={({ pressed }) => [
        styles.triggerBtn,
        { width: size, height: size, borderRadius: size * 0.3 },
        light ? styles.triggerLight : styles.triggerDark,
        pressed && styles.triggerPressed,
      ]}
      accessibilityLabel="Open menu"
      hitSlop={8}
    >
      <Ionicons name="menu" size={size * 0.5} color={light ? '#fff' : '#0a2f5b'} />
    </Pressable>
  );
}

/** Compact floating control so the menu stays reachable on every screen. */
function FloatingMenuButton({ visible }: { visible: boolean }) {
  const menu = useAppMenuOptional();
  if (!menu || !visible) return null;
  return (
    <SafeAreaView pointerEvents="box-none" style={styles.fabSafe}>
      <Pressable
        onPress={menu.openMenu}
        style={({ pressed }) => [styles.fab, pressed && styles.triggerPressed]}
        accessibilityLabel="Open menu"
      >
        <Ionicons name="menu" size={22} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

export function AppMenuProvider({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  const openMenu = useCallback(() => setMenuOpen(true), []);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const toggleMenu = useCallback(() => setMenuOpen((v) => !v), []);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const value = useMemo(
    () => ({ openMenu, closeMenu, toggleMenu, menuOpen }),
    [openMenu, closeMenu, toggleMenu, menuOpen],
  );

  // Hide FAB on home — home already has the hamburger in the hero.
  const showFab = !menuOpen && !(pathname?.includes('/home') ?? false);

  return (
    <AppMenuContext.Provider value={value}>
      <View style={styles.flex1}>
        {children}
        <FloatingMenuButton visible={showFab} />
        <AppMenuDrawer visible={menuOpen} onClose={closeMenu} />
      </View>
    </AppMenuContext.Provider>
  );
}

/** Shared stack header options with web-like menu on the right. */
export function appStackHeaderOptions(extra?: Record<string, unknown>) {
  return {
    headerStyle: { backgroundColor: colors.primaryDark },
    headerTintColor: colors.white,
    headerTitleStyle: { fontWeight: '700' as const },
    headerBackTitle: '',
    headerRight: () => (
      <View style={styles.headerRightWrap}>
        <MenuTriggerButton />
      </View>
    ),
    ...extra,
  };
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  modalRoot: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10, 25, 45, 0.45)' },
  drawer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: DRAWER_WIDTH,
    backgroundColor: '#0a2f5b',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 4, height: 0 },
    elevation: 16,
  },
  drawerInner: { flex: 1 },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
  },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1566b8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandMarkText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  brandTitle: { color: '#fff', fontSize: 16, fontWeight: '800' },
  brandSub: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 1 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  navScroll: { padding: spacing.md, gap: 4, paddingBottom: spacing.xl },
  sectionLabel: {
    marginTop: 10,
    marginBottom: 4,
    marginLeft: 4,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.45)',
  },
  toolsToggle: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  navRowActive: { backgroundColor: '#1566b8' },
  navRowPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
  navLabel: { flex: 1, color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '600' },
  navLabelActive: { color: '#fff', fontWeight: '800' },
  footer: {
    padding: spacing.md,
    gap: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.12)',
  },
  version: { color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: '700', textAlign: 'center' },
  updateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
  },
  updateText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  signOutText: { color: '#fecaca', fontSize: 13, fontWeight: '700' },
  triggerBtn: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerLight: { backgroundColor: 'rgba(255,255,255,0.15)' },
  triggerDark: { backgroundColor: '#eaf3fc', borderWidth: 1, borderColor: '#d7e4ee' },
  triggerPressed: { opacity: 0.85 },
  headerRightWrap: { marginRight: 8 },
  fabSafe: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    zIndex: 40,
  },
  fab: {
    marginLeft: spacing.md,
    marginBottom: spacing.md,
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#0a2f5b',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    shadowColor: '#0a2f5b',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
});
