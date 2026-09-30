import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContactDesignationCount, ContactEmployee, OfficeOption } from '@ibas/shared-types';
import { Chip, EmployeeCard, EmptyState } from '@/components/contacts/ContactBits';
import { OfficePickerField } from '@/components/org/OfficePickerField';
import { SearchBar } from '@/components/ui/SearchBar';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { useDebounced } from '@/hooks/useDebounced';
import { fetchDesignationCounts, fetchEmployees, type EmployeeQuery } from '@/lib/contacts-api';
import { colors, spacing } from '@/theme';

const PAGE = 40;
type Mode = 'all' | 'designation';
type Row = { kind: 'head'; key: string; title: string; grade: number | null; count: number } | { kind: 'person'; key: string; e: ContactEmployee };

/**
 * Employee list with designation filter and grouping.
 * With `officeId` the list is scoped to that office (optionally with its sub-offices);
 * without it every employee is listed and an office filter is offered.
 */
export function EmployeeDirectory({ officeId, header }: { officeId?: string; header?: ReactElement }) {
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim());
  const [designationId, setDesignationId] = useState('');
  const [office, setOffice] = useState<OfficeOption | null>(null);
  const [includeSub, setIncludeSub] = useState(true);
  const [mode, setMode] = useState<Mode>('all');

  const [counts, setCounts] = useState<ContactDesignationCount[]>([]);
  const [items, setItems] = useState<ContactEmployee[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const seq = useRef(0);

  const scopeOffice = officeId ?? office?.id ?? '';
  const base: EmployeeQuery = useMemo(
    () => ({ q: q || undefined, office_id: scopeOffice || undefined, include_sub: includeSub }),
    [q, scopeOffice, includeSub],
  );
  const limit = mode === 'designation' ? 200 : PAGE;

  useEffect(() => {
    let live = true;
    fetchDesignationCounts(base)
      .then((c) => live && setCounts(c))
      .catch(() => live && setCounts([]));
    return () => {
      live = false;
    };
  }, [base]);

  const load = useCallback(async () => {
    const mine = ++seq.current;
    setError('');
    try {
      const r = await fetchEmployees({ ...base, designation_id: designationId || undefined, page: 1, limit });
      if (mine !== seq.current) return;
      setItems(r.data);
      setTotal(r.meta.total);
      setPage(1);
    } catch (e) {
      if (mine === seq.current) setError(e instanceof Error ? e.message : 'Could not load employees');
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [base, designationId, limit]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  async function loadMore() {
    if (more || loading || items.length >= total) return;
    setMore(true);
    try {
      const r = await fetchEmployees({ ...base, designation_id: designationId || undefined, page: page + 1, limit });
      setItems((cur) => [...cur, ...r.data.filter((e) => !cur.some((c) => c.id === e.id))]);
      setTotal(r.meta.total);
      setPage(page + 1);
    } catch {
      /* keep what we have */
    } finally {
      setMore(false);
    }
  }

  const rows = useMemo<Row[]>(() => {
    if (mode === 'all') return items.map((e) => ({ kind: 'person', key: e.id, e }));
    const groups = new Map<string, { title: string; grade: number | null; people: ContactEmployee[] }>();
    for (const e of items) {
      const key = e.designation?.id ?? 'none';
      const g = groups.get(key) ?? { title: e.designation?.name ?? 'No designation', grade: e.designation?.grade ?? null, people: [] };
      g.people.push(e);
      groups.set(key, g);
    }
    const out: Row[] = [];
    for (const [key, g] of groups) {
      out.push({ kind: 'head', key: `h:${key}`, title: g.title, grade: g.grade, count: g.people.length });
      for (const e of g.people) out.push({ kind: 'person', key: e.id, e });
    }
    return out;
  }, [items, mode]);

  const allCount = counts.reduce((s, c) => s + c.count, 0);
  const showOffice = !officeId || includeSub;

  const filters = (
    <View style={styles.filters}>
      {header}
      <SearchBar value={query} onChangeText={setQuery} placeholder="Name, designation, office, email or number" />
      {!officeId ? <OfficePickerField label="Office" value={office} onChange={setOffice} placeholder="All offices" clearLabel="All offices" /> : null}
      {scopeOffice ? <SwitchRow label="Include sub-office staff" value={includeSub} onChange={setIncludeSub} /> : null}
      <View style={styles.segment}>
        {(
          [
            ['all', 'All', 'list-outline'],
            ['designation', 'By designation', 'layers-outline'],
          ] as const
        ).map(([m, label, icon]) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segBtnActive]}>
            <Ionicons name={icon} size={15} color={mode === m ? colors.white : colors.textMuted} />
            <Text style={[styles.segText, mode === m && styles.segTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      {counts.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          <Chip label="All designations" count={allCount} active={!designationId} onPress={() => setDesignationId('')} />
          {counts.map((c) => (
            <Chip
              key={c.id}
              label={c.short_name || c.name}
              count={c.count}
              active={designationId === c.id}
              onPress={() => setDesignationId(designationId === c.id ? '' : c.id)}
            />
          ))}
        </ScrollView>
      ) : null}
      {!loading && items.length > 0 ? (
        <Text style={styles.count}>
          Showing {items.length} of {total} {total === 1 ? 'person' : 'people'}
        </Text>
      ) : null}
    </View>
  );

  return (
    <FlatList
      data={loading ? [] : rows}
      keyExtractor={(r) => r.key}
      renderItem={({ item }) =>
        item.kind === 'head' ? (
          <View style={styles.groupHead}>
            <Text style={styles.groupTitle}>{item.title}</Text>
            {item.grade ? <Text style={styles.groupGrade}>Grade {item.grade}</Text> : null}
            <View style={styles.groupCount}>
              <Text style={styles.groupCountText}>{item.count}</Text>
            </View>
          </View>
        ) : (
          <EmployeeCard e={item.e} showOffice={showOffice} />
        )
      }
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={filters}
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <EmptyState
            icon="people-outline"
            title="No employees found"
            text={q || designationId ? 'Try another search or designation.' : 'Nobody has added this office to their profile yet.'}
          />
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
  filters: {
    gap: spacing.sm + 4,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 9,
  },
  segBtnActive: {
    backgroundColor: colors.primary,
  },
  segText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segTextActive: {
    color: colors.white,
  },
  chips: {
    gap: spacing.sm,
    paddingRight: spacing.md,
  },
  count: {
    fontSize: 12,
    color: colors.textMuted,
  },
  groupHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  groupTitle: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  groupGrade: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  groupCount: {
    marginLeft: 'auto',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#e8f2fa',
  },
  groupCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryDark,
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
