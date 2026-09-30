import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { ContactOffice } from '@ibas/shared-types';
import { EmptyState, OfficeCard } from '@/components/contacts/ContactBits';
import { fetchOffices } from '@/lib/contacts-api';
import { colors, spacing } from '@/theme';

const PAGE = 30;

/** Paginated office list for a type, a search, or the sub-offices of a parent. */
export function OfficeList({
  typeId,
  q,
  parentId,
  header,
  emptyTitle = 'No offices found',
  emptyText,
}: {
  typeId?: string;
  q?: string;
  parentId?: string;
  header?: ReactElement;
  emptyTitle?: string;
  emptyText?: string;
}) {
  const [items, setItems] = useState<ContactOffice[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError('');
    try {
      const r = await fetchOffices({ type_id: typeId, q, parent_id: parentId, page: 1, limit: PAGE });
      if (mine !== seq.current) return;
      setItems(r.data);
      setTotal(r.meta.total);
      setPage(1);
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : 'Could not load offices');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [typeId, q, parentId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function loadMore() {
    if (more || loading || items.length >= total) return;
    setMore(true);
    try {
      const r = await fetchOffices({ type_id: typeId, q, parent_id: parentId, page: page + 1, limit: PAGE });
      setItems((cur) => [...cur, ...r.data.filter((o) => !cur.some((c) => c.id === o.id))]);
      setTotal(r.meta.total);
      setPage(page + 1);
    } catch {
      /* keep what we have */
    } finally {
      setMore(false);
    }
  }

  return (
    <FlatList
      data={loading ? [] : items}
      keyExtractor={(o) => o.id}
      renderItem={({ item }) => <OfficeCard o={item} />}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          {header}
          {!loading && items.length > 0 ? (
            <Text style={styles.count}>
              {total} {total === 1 ? 'office' : 'offices'}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <EmptyState icon="business-outline" title={emptyTitle} text={emptyText} />
        )
      }
      ListFooterComponent={more ? <ActivityIndicator color={colors.primary} style={styles.loader} /> : null}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
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

const styles = StyleSheet.create({
  content: {
    padding: spacing.md,
    gap: spacing.sm + 4,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    gap: spacing.sm + 4,
  },
  count: {
    fontSize: 12,
    color: colors.textMuted,
  },
  loader: {
    paddingVertical: spacing.lg,
  },
  error: {
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    paddingVertical: spacing.lg,
  },
});
