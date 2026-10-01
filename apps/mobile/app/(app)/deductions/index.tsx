import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { formatDeductionAmount, type DeductionEntrySummary, type DeductionSetupItem, type DeductionSetupKind } from '@ibas/shared-types';
import { SearchBar } from '@/components/ui/SearchBar';
import { PickerSheet } from '@/components/ui/PickerSheet';
import { EmptyState } from '@/components/contacts/ContactBits';
import { IbasError } from '@/components/ibas/IbasBits';
import { DED, DED_DARK, fetchDeductions, fetchDeductionSetup } from '@/lib/deductions-api';
import { colors, spacing } from '@/theme';

type Filters = Record<DeductionSetupKind, string>;

const FILTER_LABEL: Record<DeductionSetupKind, string> = {
  economic_code: 'All economic codes',
  bill_type: 'All bill types',
  deduction_type: 'All deductions',
};

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

function EntryCard({ item, onPress }: { item: DeductionEntrySummary; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHead}>
        <Text style={styles.code}>{item.economic_code.code ?? '—'}</Text>
        <View style={styles.flex}>
          <Text style={styles.ecoName} numberOfLines={2}>
            {item.economic_code.name_en}
          </Text>
          <Text style={styles.bill} numberOfLines={1}>
            {item.bill_type.name_en}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
      {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
      <View style={styles.chips}>
        {item.deductions.map((d) => (
          <View key={d.deduction_type.id} style={styles.chip}>
            <Text style={styles.chipType}>{d.deduction_type.code || d.deduction_type.name_en}</Text>
            <Text style={styles.chipAmount} numberOfLines={1}>
              {formatDeductionAmount(d)}
            </Text>
          </View>
        ))}
      </View>
    </Pressable>
  );
}

export default function DeductionsScreen() {
  const router = useRouter();
  const [setup, setSetup] = useState<DeductionSetupItem[]>([]);
  const [filters, setFilters] = useState<Filters>({ economic_code: '', bill_type: '', deduction_type: '' });
  const [q, setQ] = useState('');
  const [items, setItems] = useState<DeductionEntrySummary[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [picker, setPicker] = useState<DeductionSetupKind | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchDeductions(filters));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load deductions');
      setItems((cur) => cur ?? []);
    }
  }, [filters]);

  useEffect(() => {
    fetchDeductionSetup()
      .then(setSetup)
      .catch(() => setSetup([]));
  }, []);

  useEffect(() => {
    setItems(null);
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const visible = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items ?? [];
    return (items ?? []).filter((i) =>
      [i.title, i.economic_code.code, i.economic_code.name_en, i.economic_code.name_bn, i.bill_type.name_en, i.bill_type.name_bn, ...i.deductions.map((d) => d.deduction_type.name_en)].some((t) =>
        t?.toLowerCase().includes(term),
      ),
    );
  }, [items, q]);

  const optionsFor = (kind: DeductionSetupKind) =>
    setup.filter((s) => s.kind === kind).map((s) => ({ value: s.id, label: s.code && kind !== 'bill_type' ? `${s.code} · ${s.name_en}` : s.name_en, hint: s.name_bn }));
  const nameOf = (kind: DeductionSetupKind) => {
    const s = setup.find((x) => x.id === filters[kind]);
    return s ? (kind === 'economic_code' ? s.code ?? s.name_en : s.name_en) : '';
  };

  const header = (
    <View style={styles.headerWrap}>
      <LinearGradient colors={[DED, '#d97706', DED_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="receipt" size={130} color="rgba(255,255,255,0.08)" style={styles.heroBg} />
        <Text style={styles.kicker}>COMMUNITY & SERVICES</Text>
        <Text style={styles.heroTitle}>VAT, IT, Tax & Deductions</Text>
        <Text style={styles.heroSub}>Deductions at source by economic code and type of bill, with the governing circulars and processes.</Text>
      </LinearGradient>

      <SearchBar value={q} onChangeText={setQ} placeholder="Search code, bill or deduction…" />

      <View style={styles.filters}>
        <FilterButton label={FILTER_LABEL.economic_code} value={nameOf('economic_code')} onPress={() => setPicker('economic_code')} />
        <FilterButton label={FILTER_LABEL.bill_type} value={nameOf('bill_type')} onPress={() => setPicker('bill_type')} />
      </View>
      <FilterButton label={FILTER_LABEL.deduction_type} value={nameOf('deduction_type')} onPress={() => setPicker('deduction_type')} />

      {error ? <IbasError message={error} /> : null}
      {items && visible.length > 0 ? (
        <Text style={styles.count}>
          {visible.length} entr{visible.length === 1 ? 'y' : 'ies'}
        </Text>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        style={styles.root}
        contentContainerStyle={styles.content}
        data={items ? visible : []}
        keyExtractor={(i) => i.id}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => <EntryCard item={item} onPress={() => router.push(`/(app)/deductions/${item.id}` as Href)} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          items === null ? (
            <ActivityIndicator size="large" color={DED} style={styles.loader} />
          ) : error ? null : (
            <EmptyState
              icon="receipt-outline"
              title="Nothing here yet"
              text={items.length ? 'No entries match your search.' : 'Deductions will appear here once the admin publishes them.'}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      />

      {picker ? (
        <PickerSheet
          visible
          title={FILTER_LABEL[picker].replace('All ', '').replace(/^\w/, (c) => c.toUpperCase())}
          options={optionsFor(picker)}
          value={filters[picker]}
          searchable
          clearLabel={FILTER_LABEL[picker]}
          onSelect={(o) => setFilters((f) => ({ ...f, [picker]: o.value }))}
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
  headerWrap: {
    gap: spacing.sm + 2,
    marginBottom: spacing.md,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  loader: {
    marginTop: spacing.lg,
  },
  sep: {
    height: spacing.sm,
  },
  hero: {
    gap: 6,
    overflow: 'hidden',
    borderRadius: 22,
    padding: spacing.lg,
    marginBottom: spacing.xs,
  },
  heroBg: {
    position: 'absolute',
    right: -18,
    top: -18,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.75)',
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 26,
    color: colors.white,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.88)',
  },
  filters: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  filterBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  filterBtnOn: {
    borderColor: DED,
    backgroundColor: DED,
  },
  filterText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  filterTextOn: {
    color: colors.white,
  },
  count: {
    fontSize: 12,
    color: colors.textMuted,
  },
  card: {
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  code: {
    minWidth: 64,
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 6,
    overflow: 'hidden',
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '800',
    color: DED_DARK,
    textAlign: 'center',
  },
  ecoName: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    color: colors.text,
  },
  bill: {
    fontSize: 12,
    fontWeight: '600',
    color: DED,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    maxWidth: '100%',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipType: {
    fontSize: 11,
    fontWeight: '800',
    color: DED_DARK,
  },
  chipAmount: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
});
