import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { BookBadge } from '@/components/books/BookBadge';
import { useAuth } from '@/lib/auth-context';
import { canManageUsers, fetchAdminUsers, type AdminUserRow } from '@/lib/users-api';
import { openPhoneDialer, openWhatsAppToNumber } from '@/lib/contact';
import { colors, spacing } from '@/theme';

import { formatMobileAppVersionForDisplay, isLatestMobileAppVersion } from '@/lib/app-version';

const PAGE_SIZE = 100;

function openContactActions(item: AdminUserRow) {
  if (!item.phone?.trim()) return;
  Alert.alert(item.full_name_en, item.phone, [
    {
      text: 'Call',
      onPress: () => openPhoneDialer(item.phone),
    },
    {
      text: 'WhatsApp',
      onPress: () =>
        openWhatsAppToNumber(item.phone, `Hi ${item.full_name_en}, regarding ProAssist.`),
    },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

export default function UsersListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [paySort, setPaySort] = useState<'paid' | 'unpaid'>('paid');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const allowed = canManageUsers(user);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const load = useCallback(async (q: string, p: number, sort: 'paid' | 'unpaid') => {
    setError('');
    try {
      const res = await fetchAdminUsers({ q, page: p, limit: PAGE_SIZE, sort });
      setItems(res.data);
      setTotal(res.meta.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!allowed) return;
      setLoading(true);
      void load(appliedQuery, page, paySort);
    }, [allowed, appliedQuery, page, paySort, load]),
  );

  const subtitle = useMemo(() => {
    if (total <= 0) return 'No users';
    const from = (page - 1) * PAGE_SIZE + 1;
    const to = Math.min(page * PAGE_SIZE, total);
    return `Showing ${from}–${to} of ${total} · page ${page}/${totalPages}`;
  }, [page, total, totalPages]);

  function applySearch() {
    setPage(1);
    setAppliedQuery(query.trim());
  }

  if (!allowed) {
    return (
      <BookEmpty
        title="Admin only"
        subtitle="User management is available to admins on this device."
      />
    );
  }

  if (loading && items.length === 0) return <BookLoading />;
  if (error && items.length === 0) return <BookError message={error} />;

  return (
    <View style={styles.root}>
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search name, email, phone..."
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={applySearch}
          />
        </View>
        <Pressable style={styles.searchBtn} onPress={applySearch}>
          <Text style={styles.searchBtnText}>Search</Text>
        </Pressable>
        <Pressable
          style={styles.addBtn}
          onPress={() => router.push('/(app)/users/new' as Href)}
          hitSlop={8}
        >
          <Ionicons name="person-add-outline" size={20} color={colors.white} />
        </Pressable>
      </View>

      <View style={styles.sortRow}>
        <Pressable
          style={[styles.sortChip, paySort === 'paid' && styles.sortChipActive]}
          onPress={() => {
            setPage(1);
            setPaySort('paid');
          }}
        >
          <Text style={[styles.sortChipText, paySort === 'paid' && styles.sortChipTextActive]}>
            Paid first
          </Text>
        </Pressable>
        <Pressable
          style={[styles.sortChip, paySort === 'unpaid' && styles.sortChipActive]}
          onPress={() => {
            setPage(1);
            setPaySort('unpaid');
          }}
        >
          <Text style={[styles.sortChipText, paySort === 'unpaid' && styles.sortChipTextActive]}>
            Unpaid first
          </Text>
        </Pressable>
      </View>

      <Text style={styles.meta}>{subtitle}</Text>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(appliedQuery, page, paySort);
            }}
          />
        }
        ListEmptyComponent={
          <BookEmpty title="No users found" subtitle="Try a different search or add a user." />
        }
        ListFooterComponent={
          total > PAGE_SIZE ? (
            <View style={styles.pager}>
              <Pressable
                style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
                disabled={page <= 1 || loading}
                onPress={() => setPage((p) => Math.max(1, p - 1))}
              >
                <Text style={styles.pageBtnText}>Previous</Text>
              </Pressable>
              <Text style={styles.pageMeta}>
                {page} / {totalPages}
              </Text>
              <Pressable
                style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
                disabled={page >= totalPages || loading}
                onPress={() => setPage((p) => p + 1)}
              >
                <Text style={styles.pageBtnText}>Next</Text>
              </Pressable>
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const paid = Number(item.amount_received ?? 0) > 0;
          const appVersion = formatMobileAppVersionForDisplay(
            item.client_app_version,
            item.client_platform,
          );
          const appUpdated = isLatestMobileAppVersion(item.client_app_version, item.client_platform);
          return (
            <View style={styles.card}>
              <Pressable
                style={({ pressed }) => [styles.cardMain, pressed && styles.pressed]}
                onPress={() => router.push(`/(app)/users/${item.id}` as Href)}
              >
                <View style={styles.iconWrap}>
                  <Ionicons name="person-outline" size={20} color="#475569" />
                </View>
                <View style={styles.body}>
                  <Text style={styles.title}>{item.full_name_en}</Text>
                  <Text style={styles.sub}>{item.phone || item.email}</Text>
                  <View style={styles.badges}>
                    <BookBadge
                      label={paid ? 'Paid' : 'Unpaid'}
                      variant={paid ? 'default' : 'warning'}
                    />
                    <BookBadge label={item.user_type} variant="muted" />
                    <BookBadge label={item.status} variant="muted" />
                  </View>
                  <Text style={styles.amount}>
                    Amount: {(item.amount_received ?? 0).toLocaleString()}
                  </Text>
                  <View style={styles.versionRow}>
                    <Text style={styles.version}>Mobile app: {appVersion}</Text>
                    {appUpdated ? (
                      <View style={styles.updatedBadge}>
                        <Text style={styles.updatedBadgeText}>Updated</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </Pressable>
              {item.phone ? (
                <Pressable
                  style={({ pressed }) => [styles.dialerBtn, pressed && styles.pressed]}
                  onPress={() => openContactActions(item)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Contact ${item.full_name_en}`}
                >
                  <Ionicons name="call-outline" size={20} color="#0369a1" />
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  toolbar: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
    paddingBottom: spacing.sm,
  },
  searchRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, paddingVertical: spacing.sm },
  searchBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  searchBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  addBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sortChipActive: {
    borderColor: colors.primary,
    backgroundColor: '#fce7f3',
  },
  sortChipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  sortChipTextActive: { color: '#9d174d' },
  meta: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  pageBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pageBtnDisabled: { opacity: 0.45 },
  pageBtnText: { fontSize: 13, fontWeight: '700', color: colors.text },
  pageMeta: { fontSize: 12, fontWeight: '600', color: colors.textMuted },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
  },
  cardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  pressed: { opacity: 0.92 },
  dialerBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e0f2fe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 4 },
  title: { fontSize: 16, fontWeight: '700', color: colors.text },
  sub: { fontSize: 13, color: colors.textMuted },
  amount: { fontSize: 12, fontWeight: '600', color: colors.text },
  versionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  version: { fontSize: 12, color: colors.textMuted },
  updatedBadge: {
    borderRadius: 999,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  updatedBadgeText: { fontSize: 11, fontWeight: '700', color: '#15803d' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
