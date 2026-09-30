import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { CIRCULAR_DOC_TYPES, CIRCULAR_ISSUERS, POLICY_COLLECTIONS } from '@ibas/shared-constants';
import type { CircularFacets, CircularRecord, CircularTagCount } from '@ibas/shared-types';
import { SearchBar } from '@/components/ui/SearchBar';
import { PickerSheet, type PickerOption } from '@/components/ui/PickerSheet';
import { EmptyState } from '@/components/contacts/ContactBits';
import { CIR, CIR_DARK, CIR_SOFT, CircularCard } from '@/components/circulars/CircularBits';
import {
  EMPTY_CIRCULAR_FILTERS,
  collectionName,
  docTypeLabel,
  fetchCircularFacets,
  fetchCircularTags,
  fetchCirculars,
  issuerLabel,
  type CircularFilters,
  type CircularSort,
} from '@/lib/circulars-api';
import { useIbasAreas } from '@/lib/ibas-areas';
import { colors, spacing } from '@/theme';

const PAGE_SIZE = 20;
type FilterKey = 'issuer' | 'doc_type' | 'collection' | 'area' | 'year' | 'tag';

function FilterButton({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const on = !!value;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.filterBtn, on && styles.filterBtnOn, pressed && styles.pressed]}>
      <Text style={[styles.filterText, on && styles.filterTextOn]} numberOfLines={1}>
        {value || label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={on ? colors.white : colors.textMuted} />
    </Pressable>
  );
}

function paramOf(v: string | string[] | undefined): string {
  return typeof v === 'string' ? v : '';
}

export default function CircularsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Record<keyof CircularFilters, string>>();
  const { activeAreas, areaName } = useIbasAreas();
  const [filters, setFilters] = useState<CircularFilters>(() => ({
    q: paramOf(params.q),
    issuer: paramOf(params.issuer),
    doc_type: paramOf(params.doc_type),
    collection: paramOf(params.collection),
    area: paramOf(params.area),
    year: paramOf(params.year),
    tag: paramOf(params.tag),
  }));
  const [qInput, setQInput] = useState(filters.q);
  const [sort, setSort] = useState<CircularSort>('newest');
  const [items, setItems] = useState<CircularRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [facets, setFacets] = useState<CircularFacets | null>(null);
  const [allTags, setAllTags] = useState<CircularTagCount[] | null>(null);
  const [picker, setPicker] = useState<FilterKey | null>(null);
  const reqId = useRef(0);

  useEffect(() => {
    fetchCircularFacets()
      .then(setFacets)
      .catch(() => setFacets(null));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      const q = qInput.trim();
      setFilters((f) => (f.q === q ? f : { ...f, q }));
    }, 450);
    return () => clearTimeout(t);
  }, [qInput]);

  const loadFirst = useCallback(async () => {
    const id = ++reqId.current;
    setError('');
    try {
      const r = await fetchCirculars(filters, sort, 0, PAGE_SIZE);
      if (id !== reqId.current) return;
      setItems(r.items);
      setTotal(r.total);
    } catch (e) {
      if (id !== reqId.current) return;
      setItems([]);
      setTotal(0);
      setError(e instanceof Error ? e.message : 'Failed to load circulars');
    }
  }, [filters, sort]);

  useEffect(() => {
    setLoading(true);
    void loadFirst().finally(() => setLoading(false));
  }, [loadFirst]);

  async function loadMore() {
    if (loading || loadingMore || items.length >= total) return;
    const id = reqId.current;
    setLoadingMore(true);
    try {
      const r = await fetchCirculars(filters, sort, items.length, PAGE_SIZE);
      if (id !== reqId.current) return;
      setItems((cur) => [...cur, ...r.items.filter((n) => !cur.some((c) => c.id === n.id))]);
      setTotal(r.total);
    } catch {
      /* keep what we have; the user can scroll again */
    } finally {
      setLoadingMore(false);
    }
  }

  async function pullRefresh() {
    setRefreshing(true);
    await loadFirst();
    setRefreshing(false);
  }

  function update(patch: Partial<CircularFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
  }

  function clearAll() {
    setQInput('');
    setFilters(EMPTY_CIRCULAR_FILTERS);
  }

  function openTagPicker() {
    setPicker('tag');
    if (!allTags) {
      fetchCircularTags()
        .then(setAllTags)
        .catch(() => setAllTags([]));
    }
  }

  const pickerConfig = useMemo((): Record<FilterKey, { title: string; clear: string; options: PickerOption[]; searchable?: boolean }> => {
    const tagSource = allTags ?? facets?.tags ?? [];
    return {
      issuer: { title: 'Issuer', clear: 'All issuers', options: CIRCULAR_ISSUERS.map((i) => ({ value: i.code, label: i.label })) },
      doc_type: { title: 'Document type', clear: 'All document types', options: CIRCULAR_DOC_TYPES.map((d) => ({ value: d.code, label: d.label })) },
      collection: {
        title: 'Policy collection',
        clear: 'All collections',
        options: POLICY_COLLECTIONS.map((c) => ({ value: c.code, label: c.name_en, hint: c.name_bn })),
      },
      area: {
        title: 'iBAS++ area',
        clear: 'All iBAS++ areas',
        options: activeAreas.map((a) => ({ value: a.code, label: a.name_en, hint: a.name_bn || undefined })),
        searchable: true,
      },
      year: { title: 'Year', clear: 'All years', options: (facets?.years ?? []).map((y) => ({ value: String(y), label: String(y) })) },
      tag: {
        title: 'Tag',
        clear: 'All tags',
        options: tagSource.map((t) => ({ value: t.tag, label: `#${t.tag}`, badge: String(t.count) })),
        searchable: true,
      },
    };
  }, [activeAreas, facets, allTags]);

  const activeCount = (['issuer', 'doc_type', 'collection', 'area', 'year', 'tag'] as const).filter((k) => filters[k]).length;
  const popularTags = (facets?.tags ?? []).slice(0, 15);
  const active = picker ? pickerConfig[picker] : null;

  const header = (
    <View style={styles.header}>
      <LinearGradient colors={[CIR, '#7c3aed', CIR_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="archive" size={140} color="rgba(255,255,255,0.08)" style={styles.heroBg} />
        <Text style={styles.kicker}>CIRCULAR ARCHIVE</Text>
        <Text style={styles.heroTitle}>Circulars, orders, SROs, gazettes & office orders</Text>
        <Text style={styles.heroSub}>
          {facets ? `${facets.total} document${facets.total === 1 ? '' : 's'} · ` : ''}search by order no., subject, ministry, wing or tag
        </Text>
      </LinearGradient>

      <SearchBar value={qInput} onChangeText={setQInput} placeholder="Order no., subject, ministry, signed by…" />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        <FilterButton label="Issuer" value={filters.issuer ? issuerLabel(filters.issuer) : ''} onPress={() => setPicker('issuer')} />
        <FilterButton label="Type" value={filters.doc_type ? docTypeLabel(filters.doc_type) : ''} onPress={() => setPicker('doc_type')} />
        <FilterButton label="Collection" value={filters.collection ? collectionName(filters.collection) : ''} onPress={() => setPicker('collection')} />
        <FilterButton label="iBAS++ area" value={filters.area ? areaName(filters.area) : ''} onPress={() => setPicker('area')} />
        <FilterButton label="Year" value={filters.year} onPress={() => setPicker('year')} />
        <FilterButton label="Tag" value={filters.tag ? `#${filters.tag}` : ''} onPress={openTagPicker} />
      </ScrollView>

      {popularTags.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
          <Ionicons name="pricetags-outline" size={14} color={colors.textMuted} />
          {popularTags.map((t) => {
            const on = filters.tag === t.tag;
            return (
              <Pressable key={t.tag} onPress={() => update({ tag: on ? '' : t.tag })} style={[styles.tagChip, on && styles.tagChipOn]}>
                <Text style={[styles.tagText, on && styles.tagTextOn]}>
                  #{t.tag} <Text style={styles.tagCount}>{t.count}</Text>
                </Text>
              </Pressable>
            );
          })}
          <Pressable onPress={openTagPicker} style={styles.tagChip}>
            <Text style={styles.tagMore}>All tags…</Text>
          </Pressable>
        </ScrollView>
      ) : null}

      <View style={styles.resultRow}>
        <Text style={styles.resultText}>{loading ? 'Loading…' : `${total} circular${total === 1 ? '' : 's'}`}</Text>
        {activeCount > 0 || filters.q ? (
          <Pressable onPress={clearAll} hitSlop={8}>
            <Text style={styles.clear}>Clear all</Text>
          </Pressable>
        ) : null}
        <View style={styles.flex} />
        <Pressable onPress={() => setSort(sort === 'newest' ? 'oldest' : 'newest')} style={styles.sortBtn} hitSlop={6}>
          <Ionicons name={sort === 'newest' ? 'arrow-down' : 'arrow-up'} size={14} color={CIR} />
          <Text style={styles.sortText}>{sort === 'newest' ? 'Newest first' : 'Oldest first'}</Text>
        </Pressable>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="lock-closed-outline" size={18} color="#991b1b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={loading ? [] : items}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <CircularCard
            c={item}
            areaName={areaName}
            onPress={() => router.push(`/(app)/circulars/${item.id}` as Href)}
            onTag={(tag) => update({ tag })}
            onArea={(area) => update({ area })}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator size="large" color={CIR} style={styles.loader} />
          ) : error ? null : (
            <EmptyState
              icon="archive-outline"
              title="No circulars found"
              text={activeCount || filters.q ? 'Try removing some filters.' : 'Circulars will appear here once the admin publishes them.'}
            />
          )
        }
        ListFooterComponent={loadingMore ? <ActivityIndicator color={CIR} style={styles.footer} /> : null}
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pullRefresh()} />}
      />
      {active && picker ? (
        <PickerSheet
          visible
          title={active.title}
          options={active.options}
          value={filters[picker]}
          clearLabel={active.clear}
          searchable={active.searchable}
          loading={picker === 'tag' && !allTags}
          emptyText={picker === 'year' ? 'No years yet.' : 'Nothing to choose from yet.'}
          onSelect={(o) => update({ [picker]: o.value } as Partial<CircularFilters>)}
          onClose={() => setPicker(null)}
        />
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  pressed: {
    opacity: 0.85,
  },
  flex: {
    flex: 1,
  },
  header: {
    gap: spacing.sm + 4,
    marginBottom: spacing.sm + 4,
  },
  hero: {
    borderRadius: 22,
    padding: spacing.lg,
    gap: 6,
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    right: -20,
    top: -20,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.75)',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
    color: colors.white,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  filterRow: {
    gap: 6,
    paddingRight: spacing.md,
  },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 200,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterBtnOn: {
    backgroundColor: CIR,
    borderColor: CIR,
  },
  filterText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  filterTextOn: {
    color: colors.white,
  },
  tagRow: {
    alignItems: 'center',
    gap: 6,
    paddingRight: spacing.md,
  },
  tagChip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tagChipOn: {
    backgroundColor: CIR,
    borderColor: CIR,
  },
  tagText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  tagTextOn: {
    color: colors.white,
  },
  tagCount: {
    opacity: 0.7,
  },
  tagMore: {
    fontSize: 12,
    fontWeight: '700',
    color: CIR,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
  },
  resultText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  clear: {
    fontSize: 13,
    fontWeight: '700',
    color: CIR,
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    backgroundColor: CIR_SOFT,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '700',
    color: CIR,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: spacing.sm + 4,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991b1b',
  },
  sep: {
    height: spacing.sm + 4,
  },
  loader: {
    marginTop: spacing.lg,
  },
  footer: {
    marginVertical: spacing.md,
  },
});
