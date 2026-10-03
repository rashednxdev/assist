import { useCallback, useRef, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BLOCKED_ACCOUNT_REASON_LABELS, type BlockedAccountReason, type BlockedAccountRecord } from '@ibas/shared-types';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { TempPasswordSheet } from '@/components/users/TempPasswordSheet';
import { useAuth } from '@/lib/auth-context';
import { canManageUsers, fetchBlockedAccounts } from '@/lib/users-api';
import { colors, spacing } from '@/theme';

const FILTERS: Array<{ id: BlockedAccountReason | 'all'; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'inactive', label: 'Inactive' },
  { id: 'locked', label: 'Locked' },
  { id: 'temp_password', label: 'Waiting' },
];

const REASON_COLOR: Record<BlockedAccountReason, { bg: string; fg: string }> = {
  suspended: { bg: '#fee2e2', fg: '#991b1b' },
  inactive: { bg: '#e2e8f0', fg: '#334155' },
  locked: { bg: '#fef3c7', fg: '#92400e' },
  temp_password: { bg: '#dbeafe', fg: '#1e40af' },
};

function when(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function BlockedAccountsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<BlockedAccountRecord[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<BlockedAccountReason | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [target, setTarget] = useState<BlockedAccountRecord | null>(null);

  const load = useCallback(async (q: string) => {
    try {
      setItems(await fetchBlockedAccounts(q));
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    }
  }, []);

  const queryRef = useRef(query);
  queryRef.current = query;

  useFocusEffect(
    useCallback(() => {
      void load(queryRef.current);
    }, [load]),
  );

  if (!canManageUsers(user)) {
    return <BookEmpty title="Admin only" subtitle="User management is available to admins." />;
  }
  if (!items && !error) return <BookLoading />;
  if (error && !items) return <BookError message={error} />;

  const all = items ?? [];
  const shown = all.filter((u) => filter === 'all' || u.reasons.includes(filter));

  return (
    <View style={styles.root}>
      <View style={styles.searchRow}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search name, phone, email..."
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          onSubmitEditing={() => void load(query)}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {FILTERS.map((f) => {
          const on = filter === f.id;
          const count = f.id === 'all' ? all.length : all.filter((u) => u.reasons.includes(f.id as BlockedAccountReason)).length;
          return (
            <Pressable key={f.id} onPress={() => setFilter(f.id)} style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && styles.chipTextOn]}>
                {f.label} ({count})
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={shown}
        keyExtractor={(u) => u.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await load(query);
              setRefreshing(false);
            }}
          />
        }
        ListEmptyComponent={<BookEmpty title="No accounts here" subtitle="Every account in this list can sign in normally." />}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable onPress={() => router.push(`/(app)/users/${item.id}` as Href)}>
              <Text style={styles.name}>{item.full_name_en}</Text>
              <Text style={styles.sub}>
                {item.phone} · {item.user_type}
              </Text>
            </Pressable>
            <View style={styles.badges}>
              {item.reasons.map((r) => (
                <View key={r} style={[styles.badge, { backgroundColor: REASON_COLOR[r].bg }]}>
                  <Text style={[styles.badgeText, { color: REASON_COLOR[r].fg }]}>{BLOCKED_ACCOUNT_REASON_LABELS[r]}</Text>
                </View>
              ))}
            </View>
            {item.reasons.includes('locked') ? (
              <Text style={styles.sub}>
                {item.failed_attempts} wrong passwords · locked until {when(item.locked_until)}
              </Text>
            ) : null}
            {item.reasons.includes('temp_password') && item.temp_password_expires_at ? (
              <Text style={styles.sub}>
                Temporary password{' '}
                {new Date(item.temp_password_expires_at).getTime() < Date.now()
                  ? 'expired — set a new one'
                  : `works until ${when(item.temp_password_expires_at)}`}
              </Text>
            ) : null}
            <Text style={styles.sub}>Last sign-in: {when(item.last_login)}</Text>
            <Pressable onPress={() => setTarget(item)} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Ionicons name="key-outline" size={16} color={colors.white} />
              <Text style={styles.actionText}>
                {item.reasons.includes('temp_password') ? 'New temporary password' : 'Set temporary password'}
              </Text>
            </Pressable>
          </View>
        )}
      />

      {target ? (
        <TempPasswordSheet
          user={target}
          onClose={() => {
            setTarget(null);
            void load(query);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  pressed: { opacity: 0.75 },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    margin: spacing.md,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 14, color: colors.text },
  filters: { paddingHorizontal: spacing.md, gap: 8, paddingBottom: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
  chipTextOn: { color: colors.white },
  list: { padding: spacing.md, paddingTop: 0, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: 6,
  },
  name: { fontSize: 15, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, lineHeight: 17 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  actionText: { color: colors.white, fontWeight: '700', fontSize: 14 },
});
