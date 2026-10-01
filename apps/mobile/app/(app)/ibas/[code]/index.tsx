import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { IbasAreaDetail } from '@ibas/shared-types';
import { SearchBar } from '@/components/ui/SearchBar';
import { IbasError, IbasErrorScreen, IbasLoading, ItemRow } from '@/components/ibas/IbasBits';
import { issuerLabel } from '@/lib/circulars-api';
import { areaHref, fetchIbasArea } from '@/lib/ibas-api';
import { formatDdMmYyyy } from '@/lib/date-format';
import { canReadAnyModule } from '@/lib/module-access';
import { useAuth } from '@/lib/auth-context';
import { openHref } from '@/lib/web-href';
import { colors, spacing } from '@/theme';

type Tab = 'procedures' | 'checklists' | 'templates' | 'guides' | 'rules' | 'circulars' | 'tools';

const KIT_TAB_KIND = { checklists: 'checklist', templates: 'template', guides: 'guide' } as const;

const TABS: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'procedures', label: 'Processes', icon: 'git-branch-outline' },
  { id: 'checklists', label: 'Checklists', icon: 'checkbox-outline' },
  { id: 'templates', label: 'Templates', icon: 'create-outline' },
  { id: 'guides', label: 'Guides', icon: 'book-outline' },
  { id: 'rules', label: 'Rules', icon: 'scale-outline' },
  { id: 'circulars', label: 'Circulars', icon: 'archive-outline' },
  { id: 'tools', label: 'Tools', icon: 'construct-outline' },
];

const KIT_EMPTY: Record<keyof typeof KIT_TAB_KIND, string> = {
  checklists: 'No checklists for this area yet.',
  templates: 'No templates for this area yet.',
  guides: 'No guides for this area yet.',
};

const KIT_ICON: Record<keyof typeof KIT_TAB_KIND, keyof typeof Ionicons.glyphMap> = {
  checklists: 'checkbox-outline',
  templates: 'create-outline',
  guides: 'book-outline',
};

function isKitTab(t: Tab): t is keyof typeof KIT_TAB_KIND {
  return t in KIT_TAB_KIND;
}

function tabCount(d: IbasAreaDetail, t: Tab): number {
  if (t === 'rules') return d.rules.length + d.collection_books.length;
  if (isKitTab(t)) return d.toolkit.filter((k) => k.kind === KIT_TAB_KIND[t]).length;
  return d[t].length;
}

function Empty({ text }: { text: string }) {
  return <Text style={styles.empty}>{text}</Text>;
}

export default function IbasAreaScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { code } = useLocalSearchParams<{ code: string }>();
  const [detail, setDetail] = useState<IbasAreaDetail | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState<Tab>('procedures');
  const [circularSort, setCircularSort] = useState<'newest' | 'oldest'>('newest');
  const [circularQuery, setCircularQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const canReadBooks = canReadAnyModule(user, ['BOOKS']);

  const load = useCallback(
    async (pickTab: boolean) => {
      if (!code) return;
      try {
        const d = await fetchIbasArea(code);
        setDetail(d);
        setError('');
        if (pickTab) {
          const first = TABS.map((t) => t.id).find((t) => tabCount(d, t) > 0);
          if (first) setTab(first);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load this area');
      }
    },
    [code],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load(false);
    setRefreshing(false);
  }

  const circulars = useMemo(() => {
    if (!detail) return [];
    const q = circularQuery.trim().toLowerCase();
    return detail.circulars
      .filter((c) => !q || c.title.toLowerCase().includes(q) || c.circular_no.toLowerCase().includes(q))
      .sort((a, b) => (circularSort === 'newest' ? b.issue_date.localeCompare(a.issue_date) : a.issue_date.localeCompare(b.issue_date)));
  }, [detail, circularQuery, circularSort]);

  if (!detail) return error ? <IbasErrorScreen message={error} /> : <IbasLoading />;

  const accent = detail.color || '#0369a1';

  function openBook(bookId: string) {
    if (!canReadBooks) {
      Alert.alert('Books access needed', 'Reading a whole book needs Books & Tools access. Rules linked to this area stay readable here.');
      return;
    }
    router.push(areaHref(detail!.code, 'book', bookId));
  }

  return (
    <>
      <Stack.Screen options={{ title: detail.name_en }} />
      <ScrollView style={styles.root} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <View style={[styles.head, { borderTopColor: accent }]}>
          <Text style={styles.kicker}>iBAS++ AREA</Text>
          <Text style={styles.title}>{detail.name_en}</Text>
          {detail.name_bn ? <Text style={styles.titleBn}>{detail.name_bn}</Text> : null}
          {detail.description_en ? <Text style={styles.desc}>{detail.description_en}</Text> : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {TABS.map((t) => {
            const on = tab === t.id;
            const n = tabCount(detail, t.id);
            return (
              <Pressable
                key={t.id}
                onPress={() => setTab(t.id)}
                style={[styles.tab, on && { backgroundColor: accent, borderColor: accent }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
              >
                <Ionicons name={t.icon} size={15} color={on ? colors.white : colors.textMuted} />
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{t.label}</Text>
                <View style={[styles.tabCount, on && styles.tabCountOn]}>
                  <Text style={[styles.tabCountText, on && styles.tabTextOn]}>{n}</Text>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>

        {error ? <IbasError message={error} /> : null}

        <View style={styles.list}>
          {tab === 'procedures' ? (
            detail.procedures.length === 0 ? (
              <Empty text="No step-by-step processes published for this area yet." />
            ) : (
              detail.procedures.map((p) => (
                <ItemRow
                  key={p.id}
                  icon="git-branch-outline"
                  title={p.name_en}
                  subtitle={p.name_bn || p.description_en}
                  meta={[`${p.total_steps} step${p.total_steps === 1 ? '' : 's'}`, p.estimated_time ? `~${p.estimated_time} min` : '']}
                  onPress={() => router.push(areaHref(detail.code, 'process', p.id))}
                />
              ))
            )
          ) : null}

          {isKitTab(tab)
            ? (() => {
                const kits = detail.toolkit.filter((k) => k.kind === KIT_TAB_KIND[tab]);
                return kits.length === 0 ? (
                  <Empty text={KIT_EMPTY[tab]} />
                ) : (
                  kits.map((k) => (
                    <ItemRow
                      key={k.id}
                      icon={KIT_ICON[tab]}
                      title={k.title}
                      subtitle={k.summary || k.title_bn}
                      meta={[k.category_label, k.size ? `${k.size} ${tab === 'checklists' ? 'items' : tab === 'templates' ? 'fields' : 'sections'}` : '']}
                      onPress={() => router.push(areaHref(detail.code, 'kit', k.id))}
                    />
                  ))
                );
              })()
            : null}

          {tab === 'rules' ? (
            <>
              {detail.rules.length === 0 && detail.collection_books.length === 0 ? <Empty text="No rules have been linked to this area yet." /> : null}
              {detail.rules.map((r) =>
                r.kind === 'book_topic' ? (
                  <ItemRow
                    key={r.link_id ?? r.id}
                    icon="scale-outline"
                    title={r.title}
                    subtitle={r.snippet}
                    meta={r.subtitle ? [r.subtitle] : []}
                    note={r.note}
                    onPress={() => router.push(areaHref(detail.code, 'rule', r.id))}
                  />
                ) : (
                  <ItemRow
                    key={r.link_id ?? r.id}
                    icon="book-outline"
                    title={r.title}
                    subtitle={r.subtitle}
                    meta={['Whole book']}
                    note={r.note}
                    locked={!canReadBooks}
                    onPress={() => openBook(r.id)}
                  />
                ),
              )}
              {detail.collection_books.length > 0 ? (
                <>
                  <Text style={styles.groupLabel}>Related books</Text>
                  {detail.collection_books.map((b) => (
                    <ItemRow key={b.id} icon="book-outline" title={b.name} subtitle={b.name_bn} locked={!canReadBooks} onPress={() => openBook(b.id)} />
                  ))}
                  {!canReadBooks ? <Text style={styles.hint}>Whole books need Books & Tools access. Linked rules above are readable with area access.</Text> : null}
                </>
              ) : null}
            </>
          ) : null}

          {tab === 'circulars' ? (
            <>
              {detail.circulars.length > 6 ? <SearchBar value={circularQuery} onChangeText={setCircularQuery} placeholder="Search by title or memo no." /> : null}
              {detail.circulars.length > 1 ? (
                <View style={styles.sortRow}>
                  <Text style={styles.metaText}>
                    {circulars.length === detail.circulars.length ? `${detail.circulars.length} circulars` : `${circulars.length} of ${detail.circulars.length}`}
                  </Text>
                  <Pressable onPress={() => setCircularSort(circularSort === 'newest' ? 'oldest' : 'newest')} style={styles.sortBtn} hitSlop={6}>
                    <Ionicons name={circularSort === 'newest' ? 'arrow-down' : 'arrow-up'} size={14} color={accent} />
                    <Text style={[styles.sortText, { color: accent }]}>{circularSort === 'newest' ? 'Newest first' : 'Oldest first'}</Text>
                  </Pressable>
                </View>
              ) : null}
              {detail.circulars.length === 0 ? (
                <Empty text="No circulars filed under this area yet." />
              ) : circulars.length === 0 ? (
                <Empty text="No circulars match your search." />
              ) : (
                circulars.map((c) => (
                  <ItemRow
                    key={c.link_id ?? c.id}
                    icon="archive-outline"
                    title={c.title}
                    meta={[c.circular_no, issuerLabel(c.issuer), formatDdMmYyyy(c.issue_date)]}
                    note={c.note}
                    onPress={() => router.push(areaHref(detail.code, 'circular', c.id))}
                  />
                ))
              )}
            </>
          ) : null}

          {tab === 'tools' ? (
            detail.tools.length === 0 ? (
              <Empty text="Calculators and smart tools for this area are coming soon." />
            ) : (
              detail.tools.map((t) => <ItemRow key={t.key} icon="calculator-outline" title={t.title} subtitle={t.description} onPress={() => openHref(router, t.href)} />)
            )
          ) : null}
        </View>
      </ScrollView>
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
    gap: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  head: {
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderTopWidth: 5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: colors.textMuted,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  titleBn: {
    fontSize: 14,
    color: colors.textMuted,
  },
  desc: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  tabs: {
    gap: 6,
    paddingRight: spacing.md,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tabTextOn: {
    color: colors.white,
  },
  tabCount: {
    minWidth: 20,
    alignItems: 'center',
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 5,
  },
  tabCountOn: {
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  tabCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  list: {
    gap: spacing.sm,
  },
  empty: {
    fontSize: 13,
    textAlign: 'center',
    color: colors.textMuted,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
  },
  groupLabel: {
    marginTop: spacing.sm,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  sortText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
