import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import type { ContactDepartment } from '@ibas/shared-types';
import { ContactsGate } from '@/components/contacts/ContactAccess';
import { EmptyState, OfficeCard } from '@/components/contacts/ContactBits';
import { SearchBar } from '@/components/ui/SearchBar';
import { fetchDepartments } from '@/lib/contacts-api';
import { colors, spacing } from '@/theme';

export default function DepartmentsScreen() {
  return (
    <ContactsGate>
      <Departments />
    </ContactsGate>
  );
}

function Departments() {
  const [items, setItems] = useState<ContactDepartment[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await fetchDepartments());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load departments');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!items || !term) return items ?? [];
    return items.filter((d) => [d.name, d.name_bn, d.short_name, d.office_code].some((t) => t?.toLowerCase().includes(term)));
  }, [items, query]);

  return (
    <FlatList
      style={styles.root}
      data={visible}
      keyExtractor={(d) => d.id}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.intro}>Choose a department, then open any of its offices to see their contacts and employees.</Text>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search departments" />
        </View>
      }
      renderItem={({ item: d }) => (
        <View style={styles.item}>
          <View style={styles.meta}>
            {d.is_my_department ? <Text style={styles.mine}>Your department</Text> : null}
            <Text style={styles.counts}>
              {d.office_count} {d.office_count === 1 ? 'office' : 'offices'} · {d.employee_total} {d.employee_total === 1 ? 'employee' : 'employees'}
            </Text>
          </View>
          <OfficeCard o={d} />
        </View>
      )}
      ListEmptyComponent={
        items ? (
          <EmptyState
            icon="business-outline"
            title="No departments found"
            text={query ? 'Try a different name or short name.' : 'Departments appear once an administrator adds top-level offices.'}
          />
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

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    gap: spacing.sm + 4,
  },
  intro: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  item: {
    gap: 6,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  mine: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.white,
    backgroundColor: '#059669',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  counts: {
    fontSize: 12,
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
});
