import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { BookBadge } from '@/components/books/BookBadge';
import { useAuth } from '@/lib/auth-context';
import { fetchAdminUsers, type AdminUserRow } from '@/lib/users-api';
import { colors, spacing } from '@/theme';

function isAdminUser(user: ReturnType<typeof useAuth>['user']) {
  return Boolean(
    user?.is_super_admin || user?.user_type === 'system_admin' || user?.user_type === 'admin',
  );
}

export default function UsersListScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [items, setItems] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const allowed = isAdminUser(user);

  const load = useCallback(async (q: string) => {
    setError('');
    try {
      const res = await fetchAdminUsers({ q, page: 1, limit: 50 });
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
      void load(appliedQuery);
    }, [allowed, appliedQuery, load]),
  );

  const subtitle = useMemo(
    () => (total > 0 ? `${items.length} of ${total} shown` : 'No users'),
    [items.length, total],
  );

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
            onSubmitEditing={() => setAppliedQuery(query.trim())}
          />
        </View>
        <Pressable style={styles.searchBtn} onPress={() => setAppliedQuery(query.trim())}>
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
              void load(appliedQuery);
            }}
          />
        }
        ListEmptyComponent={
          <BookEmpty title="No users found" subtitle="Try a different search or add a user." />
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            onPress={() => router.push(`/(app)/users/${item.id}` as Href)}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="person-outline" size={20} color="#475569" />
            </View>
            <View style={styles.body}>
              <Text style={styles.title}>{item.full_name_en}</Text>
              <Text style={styles.sub}>{item.phone || item.email}</Text>
              <View style={styles.badges}>
                <BookBadge label={item.user_type} variant="muted" />
                <BookBadge label={item.status} variant="muted" />
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
          </Pressable>
        )}
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
  meta: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs,
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  list: { padding: spacing.md, gap: spacing.sm, paddingBottom: spacing.xl },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  pressed: { opacity: 0.92 },
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
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
});
