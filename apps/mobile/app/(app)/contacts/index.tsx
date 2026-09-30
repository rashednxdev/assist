import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import type { ContactFavorites, ContactOverview } from '@ibas/shared-types';
import { ContactsGate, useContactAccess } from '@/components/contacts/ContactAccess';
import { Chip, EmployeeCard, EmptyState, OfficeCard, officeHref } from '@/components/contacts/ContactBits';
import { OfficeList } from '@/components/contacts/OfficeList';
import { EmployeeDirectory } from '@/components/contacts/EmployeeDirectory';
import { Batchmates } from '@/components/contacts/Batchmates';
import { DirectoryPrivacy } from '@/components/contacts/DirectoryPrivacy';
import { SearchBar } from '@/components/ui/SearchBar';
import { useDebounced } from '@/hooks/useDebounced';
import { fetchContactOverview, fetchFavorites } from '@/lib/contacts-api';
import { colors, spacing } from '@/theme';

type Tab = 'offices' | 'people' | 'batchmates' | 'favorites';

const TABS: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'offices', label: 'Offices', icon: 'business-outline', activeIcon: 'business' },
  { id: 'people', label: 'People', icon: 'people-outline', activeIcon: 'people' },
  { id: 'batchmates', label: 'Batchmates', icon: 'school-outline', activeIcon: 'school' },
  { id: 'favorites', label: 'Favourites', icon: 'star-outline', activeIcon: 'star' },
];

export default function ContactsScreen() {
  return (
    <ContactsGate>
      <ContactsHome />
    </ContactsGate>
  );
}

function ContactsHome() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const initial = TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : 'offices';
  const [tab, setTab] = useState<Tab>(initial);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  return (
    <View style={styles.root}>
      <UnpaidBanner />
      <View style={styles.tabs}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, active && styles.tabActive]}>
              <Ionicons name={active ? t.activeIcon : t.icon} size={18} color={active ? colors.white : colors.textMuted} />
              <Text style={[styles.tabText, active && styles.tabTextActive]} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
        <Pressable onPress={() => setPrivacyOpen(true)} style={styles.privacyBtn} hitSlop={6} accessibilityLabel="Directory privacy">
          <Ionicons name="eye-off-outline" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.body}>
        {tab === 'offices' ? <OfficesTab /> : null}
        {tab === 'people' ? <EmployeeDirectory /> : null}
        {tab === 'batchmates' ? <Batchmates /> : null}
        {tab === 'favorites' ? <FavoritesTab /> : null}
      </View>
      <PrivacySheet visible={privacyOpen} onClose={() => setPrivacyOpen(false)} />
    </View>
  );
}

function UnpaidBanner() {
  const { access, requestUpgrade } = useContactAccess();
  if (!access || access.can_dial) return null;
  return (
    <Pressable style={styles.banner} onPress={requestUpgrade}>
      <Ionicons name="lock-closed" size={16} color="#b45309" />
      <Text style={styles.bannerText}>Browsing is free. Numbers are partly hidden — calling is part of any package.</Text>
      <Text style={styles.bannerCta}>Unlock</Text>
    </Pressable>
  );
}

function PrivacySheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const { access, setAccess } = useContactAccess();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView edges={['bottom']} style={styles.sheet}>
        <View style={styles.sheetHead}>
          <Text style={styles.sheetTitle}>Directory privacy</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        {access ? <DirectoryPrivacy initial={access.privacy} onChange={(privacy) => setAccess({ ...access, privacy })} /> : null}
        <Text style={styles.sheetNote}>
          Your name, designation and office are always listed so colleagues can find you.{' '}
          <Text
            style={styles.sheetLink}
            onPress={() => {
              onClose();
              router.push('/(app)/account/work' as Href);
            }}
          >
            Change office or designation
          </Text>
        </Text>
      </SafeAreaView>
    </Modal>
  );
}

function OfficesTab() {
  const router = useRouter();
  const { access } = useContactAccess();
  const [overview, setOverview] = useState<ContactOverview | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const [typeId, setTypeId] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setOverview(await fetchContactOverview());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load contacts');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const activeGroup = overview?.groups.find((g) => g.type.id === typeId);

  const filters = (
    <View style={styles.filters}>
      {overview ? (
        <View style={styles.stats}>
          <Stat icon="business" label="Offices" value={overview.totals.offices} />
          <Stat icon="people" label="Employees" value={overview.totals.employees} />
          <Stat icon="layers" label="Types" value={overview.totals.office_types} />
        </View>
      ) : null}
      {access?.my_office_id ? (
        <Pressable style={styles.myOffice} onPress={() => router.push(officeHref(access.my_office_id!))}>
          <Ionicons name="home" size={16} color={colors.primary} />
          <Text style={styles.myOfficeText}>My office</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
      <SearchBar value={query} onChangeText={setQuery} placeholder="Office name, short name, code, email or address" />
      {overview && overview.groups.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          <Chip label="All types" count={overview.totals.offices} active={!typeId} onPress={() => setTypeId('')} />
          {overview.groups.map((g) => (
            <Chip
              key={g.type.id}
              label={g.type.short_name || g.type.name}
              count={g.office_count}
              active={typeId === g.type.id}
              onPress={() => setTypeId(typeId === g.type.id ? '' : g.type.id)}
            />
          ))}
        </ScrollView>
      ) : null}
      {activeGroup ? <Text style={styles.groupTitle}>{activeGroup.type.name}</Text> : null}
    </View>
  );

  if (q || typeId) {
    return (
      <OfficeList
        key={`${typeId}|${q}`}
        typeId={typeId || undefined}
        q={q || undefined}
        header={filters}
        emptyText={q ? 'Try a different name, short name or office code.' : undefined}
      />
    );
  }

  const groups = overview?.groups ?? [];
  return (
    <FlatList
      data={groups}
      keyExtractor={(g) => g.type.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={filters}
      renderItem={({ item: g }) => (
        <View style={styles.group}>
          <View style={styles.groupHead}>
            <View style={styles.flex}>
              <Text style={styles.groupTitle}>{g.type.name}</Text>
              <Text style={styles.groupSub}>
                {g.office_count} {g.office_count === 1 ? 'office' : 'offices'}
              </Text>
            </View>
            {g.office_count > g.offices.length ? (
              <Pressable onPress={() => setTypeId(g.type.id)} hitSlop={8} style={styles.viewAll}>
                <Text style={styles.viewAllText}>View all</Text>
                <Ionicons name="arrow-forward" size={14} color={colors.primary} />
              </Pressable>
            ) : null}
          </View>
          {g.offices.map((o) => (
            <OfficeCard key={o.id} o={o} />
          ))}
        </View>
      )}
      ListEmptyComponent={
        overview ? (
          <EmptyState icon="business-outline" title="No offices yet" text="Offices appear here once an administrator adds them." />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        )
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    />
  );
}

function Stat({ icon, label, value }: { icon: keyof typeof Ionicons.glyphMap; label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{label}</Text>
      </View>
    </View>
  );
}

function FavoritesTab() {
  const [data, setData] = useState<ContactFavorites | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await fetchFavorites());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load favourites');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const drop = (kind: 'offices' | 'employees', id: string) => (on: boolean) => {
    if (on) return;
    setData((cur) => (cur ? { ...cur, [kind]: cur[kind].filter((x) => x.id !== id) } : cur));
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
        />
      }
    >
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!data ? (
        error ? null : <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : !data.offices.length && !data.employees.length ? (
        <EmptyState icon="star-outline" title="No favourites yet" text="Tap the star on any office or person to keep them here for quick access." />
      ) : (
        <>
          {data.offices.length > 0 ? (
            <View style={styles.group}>
              <Text style={styles.sectionLabel}>OFFICES ({data.offices.length})</Text>
              {data.offices.map((o) => (
                <OfficeCard key={o.id} o={o} onFavorite={drop('offices', o.id)} />
              ))}
            </View>
          ) : null}
          {data.employees.length > 0 ? (
            <View style={styles.group}>
              <Text style={styles.sectionLabel}>PEOPLE ({data.employees.length})</Text>
              {data.employees.map((e) => (
                <EmployeeCard key={e.id} e={e} onFavorite={drop('employees', e.id)} />
              ))}
            </View>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#fffbeb',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  bannerText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    color: '#92400e',
  },
  bannerCta: {
    fontSize: 12,
    fontWeight: '800',
    color: '#b45309',
  },
  tabs: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 6,
    borderRadius: 10,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.white,
  },
  privacyBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  filters: {
    gap: spacing.sm + 4,
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stat: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm + 2,
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  myOffice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#e8f2fa',
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  myOfficeText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  group: {
    gap: spacing.sm + 4,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 6,
  },
  groupTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  groupSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  viewAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.primary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.textMuted,
  },
  loader: {
    paddingVertical: spacing.xl,
  },
  error: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.md,
    gap: spacing.md,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  sheetNote: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  sheetLink: {
    color: colors.primary,
    fontWeight: '700',
  },
});
