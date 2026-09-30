import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { TOOLKIT_KINDS, toolkitCategoriesFor, type ToolkitKind } from '@ibas/shared-constants';
import type { ToolkitItemSummary } from '@ibas/shared-types';
import { SearchBar } from '@/components/ui/SearchBar';
import { PickerSheet } from '@/components/ui/PickerSheet';
import { EmptyState } from '@/components/contacts/ContactBits';
import { AccessRequiredScreen, type AccessRequiredVariant } from '@/components/home/AccessRequiredScreen';
import { IbasError } from '@/components/ibas/IbasBits';
import { useAuth } from '@/lib/auth-context';
import { fetchToolkit, toolkitCategoryLabel, toolkitSizeLabel } from '@/lib/ibas-api';
import { useIbasAreas } from '@/lib/ibas-areas';
import { colors, spacing } from '@/theme';

const TK = '#0f766e';
const TK_DARK = '#134e4a';

const KIND_META: Record<ToolkitKind, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
  checklist: { icon: 'checkbox-outline', color: '#059669', label: 'Checklist' },
  template: { icon: 'create-outline', color: '#2563eb', label: 'Template' },
  guide: { icon: 'book-outline', color: '#d97706', label: 'Guide' },
};

function isKind(v: string): v is ToolkitKind {
  return v in KIND_META;
}

function FilterButton({ label, value, onPress, disabled }: { label: string; value: string; onPress: () => void; disabled?: boolean }) {
  const on = !!value;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.filterBtn, on && styles.filterBtnOn, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={[styles.filterText, on && styles.filterTextOn]} numberOfLines={1}>
        {value || label}
      </Text>
      <Ionicons name="chevron-down" size={14} color={on ? colors.white : colors.textMuted} />
    </Pressable>
  );
}

function ItemCard({ item, areaName, onPress }: { item: ToolkitItemSummary; areaName: (c: string) => string; onPress: () => void }) {
  const meta = KIND_META[item.kind];
  const locked = item.access !== 'open';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, locked && styles.cardLocked, pressed && styles.pressed]}>
      <View style={[styles.kindIcon, { backgroundColor: `${meta.color}1a` }]}>
        <Ionicons name={meta.icon} size={22} color={meta.color} />
      </View>
      <View style={styles.flex}>
        <View style={styles.metaRow}>
          <Text style={[styles.kindLabel, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.metaText} numberOfLines={1}>
            · {toolkitCategoryLabel(item.category)} · {toolkitSizeLabel(item)}
          </Text>
        </View>
        <Text style={styles.cardTitle}>{item.title}</Text>
        {item.title_bn ? <Text style={styles.cardTitleBn}>{item.title_bn}</Text> : null}
        {item.summary ? (
          <Text style={styles.cardSummary} numberOfLines={2}>
            {item.summary}
          </Text>
        ) : null}
        {item.areas.length > 0 ? (
          <View style={styles.areas}>
            {item.areas.map((a) => (
              <Text key={a} style={styles.area} numberOfLines={1}>
                {areaName(a)}
              </Text>
            ))}
          </View>
        ) : null}
      </View>
      {item.access === 'stopped' ? (
        <Ionicons name="pause-circle" size={20} color="#d97706" />
      ) : locked ? (
        <Ionicons name="lock-closed" size={18} color={colors.textMuted} />
      ) : (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

export default function ToolkitScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams<{ kind?: string; area?: string }>();
  const { activeAreas, areaName } = useIbasAreas();
  const [kind, setKind] = useState<ToolkitKind | ''>(() => (typeof params.kind === 'string' && isKind(params.kind) ? params.kind : ''));
  const [area, setArea] = useState(typeof params.area === 'string' ? params.area : '');
  const [category, setCategory] = useState('');
  const [q, setQ] = useState('');
  const [items, setItems] = useState<ToolkitItemSummary[] | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [picker, setPicker] = useState<'area' | 'category' | null>(null);
  const [dialog, setDialog] = useState<{ variant: AccessRequiredVariant; title: string; reason?: string } | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await fetchToolkit({ kind, area }));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load the toolkit');
      setItems((cur) => cur ?? []);
    }
  }, [kind, area]);

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
    return (items ?? []).filter(
      (i) => (!category || i.category === category) && (!term || [i.title, i.title_bn, i.summary, ...i.tags].some((t) => t?.toLowerCase().includes(term))),
    );
  }, [items, category, q]);

  const categories = kind ? toolkitCategoriesFor(kind) : [];

  function pickKind(k: ToolkitKind | '') {
    setKind(k);
    setCategory('');
  }

  function open(item: ToolkitItemSummary) {
    if (item.access !== 'open') {
      setDialog({ variant: item.access, title: item.title, reason: item.stopped_reason });
      return;
    }
    router.push(`/(app)/toolkit/${item.id}` as Href);
  }

  const header = (
    <View style={styles.headerWrap}>
      <LinearGradient colors={[TK, '#0d9488', TK_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="clipboard" size={130} color="rgba(255,255,255,0.08)" style={styles.heroBg} />
        <Text style={styles.kicker}>TOOLKIT</Text>
        <Text style={styles.heroTitle}>Checklists, templates & guides</Text>
        <Text style={styles.heroSub}>Ready-to-use tools for pre-audit, bill scrutiny, broadsheet replies, cash book and more.</Text>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.kinds}>
        {[{ code: '' as const, label_plural: 'All' }, ...TOOLKIT_KINDS].map((k) => {
          const on = kind === k.code;
          return (
            <Pressable key={k.code || 'all'} onPress={() => pickKind(k.code)} style={[styles.kindChip, on && styles.kindChipOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              {k.code ? <Ionicons name={KIND_META[k.code].icon} size={14} color={on ? colors.white : colors.textMuted} /> : null}
              <Text style={[styles.kindChipText, on && styles.kindChipTextOn]}>{k.label_plural}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <SearchBar value={q} onChangeText={setQ} placeholder="Filter by title or tag…" />

      <View style={styles.filters}>
        <FilterButton label="All areas" value={area ? areaName(area) : ''} onPress={() => setPicker('area')} />
        <FilterButton
          label={kind ? 'All categories' : 'Pick a type for categories'}
          value={category ? toolkitCategoryLabel(category) : ''}
          onPress={() => setPicker('category')}
          disabled={!kind}
        />
      </View>

      {error ? <IbasError message={error} /> : null}
      {items && visible.length > 0 ? (
        <Text style={styles.count}>
          {visible.length} item{visible.length === 1 ? '' : 's'}
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
        renderItem={({ item }) => <ItemCard item={item} areaName={areaName} onPress={() => open(item)} />}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        ListEmptyComponent={
          items === null ? (
            <ActivityIndicator size="large" color={TK} style={styles.loader} />
          ) : error ? null : (
            <EmptyState
              icon="clipboard-outline"
              title="Nothing here yet"
              text={items.length ? 'No items match these filters.' : 'Checklists, templates and guides will appear here once the admin publishes them.'}
            />
          )
        }
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
      />

      <PickerSheet
        visible={picker === 'area'}
        title="iBAS++ area"
        options={activeAreas.map((a) => ({ value: a.code, label: a.name_en, hint: a.name_bn }))}
        value={area}
        clearLabel="All areas"
        onSelect={(o) => setArea(o.value)}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'category'}
        title="Category"
        options={categories.map((c) => ({ value: c.code, label: c.label }))}
        value={category}
        clearLabel="All categories"
        onSelect={(o) => setCategory(o.value)}
        onClose={() => setPicker(null)}
      />

      {dialog ? (
        <AccessRequiredScreen
          visible
          variant={dialog.variant}
          moduleTitle={dialog.title}
          stoppedReason={dialog.reason}
          unpaidMessage={user?.unpaid_message}
          onClose={() => setDialog(null)}
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
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.5,
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
  kinds: {
    gap: 6,
    paddingRight: spacing.md,
  },
  kindChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  kindChipOn: {
    borderColor: TK,
    backgroundColor: TK,
  },
  kindChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  kindChipTextOn: {
    color: colors.white,
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
    borderColor: TK,
    backgroundColor: TK,
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
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  cardLocked: {
    opacity: 0.8,
  },
  kindIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kindLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  metaText: {
    flex: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  cardTitle: {
    marginTop: 3,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    color: colors.text,
  },
  cardTitleBn: {
    fontSize: 13,
    color: colors.textMuted,
  },
  cardSummary: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textMuted,
  },
  areas: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    marginTop: 6,
  },
  area: {
    fontSize: 11,
    fontWeight: '600',
    color: TK_DARK,
    backgroundColor: '#f0fdfa',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
