import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  COMMUNITY_SORTS,
  COMMUNITY_SORT_LABELS,
  type CommunityFilter,
  type CommunityLinkType,
  type CommunityOverview,
  type CommunitySort,
  type CommunityThreadSummary,
} from '@ibas/shared-types';
import { EmptyState, Avatar } from '@/components/contacts/ContactBits';
import { PickerSheet, type PickerOption } from '@/components/ui/PickerSheet';
import { AuthorRow, Badge, LinkKindIcons, Notice, TEAL, TagPill } from '@/components/community/CommunityBits';
import { fetchOverview, fetchThreads, threadHref, timeAgo } from '@/lib/community-api';
import { colors, spacing } from '@/theme';

const FILTER_LABELS: Record<CommunityFilter, string> = {
  all: 'All discussions',
  following: 'Following',
  mine: 'My posts',
  solved: 'Solved',
  unsolved: 'Needs an answer',
};

const LINK_FILTERS: PickerOption[] = [
  { value: 'task', label: 'Tagged workflow' },
  { value: 'toolkit', label: 'Tagged toolkit / checklist' },
  { value: 'circular', label: 'Tagged circular' },
];

const PAGE_SIZE = 20;

function ThreadCard({ t }: { t: CommunityThreadSummary }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push(threadHref(t.id))}
      style={({ pressed }) => [styles.card, t.is_pinned && styles.cardPinned, t.is_hidden && styles.cardHidden, pressed && styles.pressed]}
    >
      <View style={styles.badges}>
        {t.is_pinned ? <Badge text="Pinned" icon="pin" bg={TEAL} fg={colors.white} /> : null}
        {t.category ? <Badge text={t.category.name} dot={t.category.color} bg={colors.surface} style={styles.outline} /> : null}
        {t.is_solved ? <Badge text="Solved" icon="checkmark-circle" bg="#ecfdf5" fg="#047857" /> : null}
        {t.is_locked ? <Badge text="Locked" icon="lock-closed" /> : null}
        {t.is_hidden ? <Badge text="Hidden" icon="eye-off" bg="#fef2f2" fg="#b91c1c" /> : null}
      </View>
      <Text style={styles.title}>{t.title}</Text>
      {t.excerpt ? (
        <Text style={styles.excerpt} numberOfLines={2}>
          {t.excerpt}
        </Text>
      ) : null}
      {t.tags.length > 0 || t.link_kinds.length > 0 ? (
        <View style={styles.badges}>
          <LinkKindIcons kinds={t.link_kinds} />
          {t.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </View>
      ) : null}
      <AuthorRow author={t.author} size={28} short meta={`asked ${timeAgo(t.created_at)}`} />
      <View style={styles.stats}>
        <View style={styles.stat}>
          <Ionicons name="chevron-up" size={14} color={t.voted ? TEAL : colors.textMuted} />
          <Text style={styles.statText}>{t.vote_score}</Text>
        </View>
        <View style={[styles.stat, t.is_solved ? styles.statSolved : t.answer_count > 0 ? styles.statAnswered : null]}>
          <Ionicons name="chatbubble-outline" size={13} color={t.is_solved ? colors.white : t.answer_count > 0 ? '#047857' : colors.textMuted} />
          <Text style={[styles.statText, t.is_solved ? styles.statTextSolved : t.answer_count > 0 ? styles.statTextAnswered : null]}>
            {t.answer_count} {t.answer_count === 1 ? 'answer' : 'answers'}
          </Text>
        </View>
        <View style={styles.stat}>
          <Ionicons name="eye-outline" size={13} color={colors.textMuted} />
          <Text style={styles.statText}>{t.view_count}</Text>
        </View>
        {t.following ? <Ionicons name="bookmark" size={14} color={TEAL} /> : null}
        <View style={styles.flex} />
        {t.last_answer_by && t.answer_count > 0 ? (
          <Text style={styles.last} numberOfLines={1}>
            {t.last_answer_by} · {timeAgo(t.last_activity_at)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <View style={styles.activeChip}>
      <Text style={styles.activeText} numberOfLines={1}>
        {label}
      </Text>
      <Pressable onPress={onClear} hitSlop={8} accessibilityLabel={`Clear ${label}`}>
        <Ionicons name="close" size={13} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

export default function CommunityScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tag?: string; category?: string }>();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(params.category ?? '');
  const [tag, setTag] = useState(params.tag ?? '');
  const [sort, setSort] = useState<CommunitySort>('active');
  const [filter, setFilter] = useState<CommunityFilter>('all');
  const [linkType, setLinkType] = useState<CommunityLinkType | ''>('');
  const [picker, setPicker] = useState<'filter' | 'link' | null>(null);

  const [overview, setOverview] = useState<CommunityOverview | null>(null);
  const [items, setItems] = useState<CommunityThreadSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const firstFocus = useRef(true);

  useEffect(() => {
    if (params.tag !== undefined) setTag(params.tag);
    if (params.category !== undefined) setCategory(params.category);
  }, [params.tag, params.category]);

  const load = useCallback(
    (p: number) => fetchThreads({ q: q || undefined, category, tag, link_type: linkType, sort, filter, page: p, limit: PAGE_SIZE }),
    [q, category, tag, linkType, sort, filter],
  );

  useEffect(() => {
    fetchOverview()
      .then(setOverview)
      .catch(() => setOverview(null));
  }, [reloadKey]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    load(1)
      .then((r) => {
        if (!alive) return;
        setItems(r.data);
        setTotal(r.meta.total);
        setPage(1);
      })
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Could not load discussions'))
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      alive = false;
    };
  }, [load, reloadKey]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setReloadKey((k) => k + 1);
    }, []),
  );

  async function loadMore() {
    if (more || loading || items.length >= total) return;
    setMore(true);
    try {
      const r = await load(page + 1);
      setItems((cur) => [...cur, ...r.data.filter((t) => !cur.some((c) => c.id === t.id))]);
      setTotal(r.meta.total);
      setPage(page + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more');
    } finally {
      setMore(false);
    }
  }

  function clearAll() {
    setSearch('');
    setQ('');
    setCategory('');
    setTag('');
    setFilter('all');
    setLinkType('');
  }

  const hasFilters = Boolean(q || category || tag || linkType || filter !== 'all');
  const activeCat = overview?.categories.find((c) => c.id === category);

  const header = (
    <View style={styles.headerWrap}>
      <LinearGradient colors={['#0f766e', '#0d9488', '#0369a1']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.kicker}>
          <Ionicons name="chatbubbles" size={13} color={colors.white} />
          <Text style={styles.kickerText}>Community</Text>
        </View>
        <Text style={styles.heroTitle}>Ask, share and learn together</Text>
        <Text style={styles.heroSub}>
          Discuss circulars, iBAS++ changes, bills, pension and exams. Tag the related workflow, checklist or circular so answers point to the right source.
        </Text>
        {overview ? (
          <View style={styles.heroStats}>
            <Text style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{overview.stats.threads}</Text> discussions
            </Text>
            <Text style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{overview.stats.answers}</Text> answers
            </Text>
            <Text style={styles.heroStat}>
              <Text style={styles.heroStatNum}>{overview.stats.solved}</Text> solved
            </Text>
          </View>
        ) : null}
        <View style={styles.heroActions}>
          <Pressable style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]} onPress={() => router.push('/(app)/community/new' as Href)}>
            <Ionicons name="add" size={17} color="#115e59" />
            <Text style={styles.heroBtnText}>Start a discussion</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [styles.heroBtn, styles.heroBtnRed, pressed && styles.pressed]} onPress={() => router.push('/(app)/blood-bank' as Href)}>
            <Ionicons name="water" size={15} color={colors.white} />
            <Text style={[styles.heroBtnText, styles.heroBtnTextRed]}>Blood bank</Text>
          </Pressable>
        </View>
        <View style={styles.search}>
          <Ionicons name="search" size={18} color="#94a3b8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={() => setQ(search.trim())}
            returnKeyType="search"
            placeholder="Search, e.g. “GPF advance”, “bill return”"
            placeholderTextColor="#94a3b8"
            style={styles.searchInput}
            autoCorrect={false}
          />
          {search ? (
            <Pressable
              onPress={() => {
                setSearch('');
                setQ('');
              }}
              hitSlop={8}
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color="#94a3b8" />
            </Pressable>
          ) : null}
        </View>
      </LinearGradient>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        <Pressable onPress={() => setCategory('')} style={[styles.cat, !category && styles.catAll]}>
          <Text style={[styles.catText, !category && styles.catTextOn]}>All topics</Text>
        </Pressable>
        {overview?.categories.map((c) => {
          const on = category === c.id;
          return (
            <Pressable key={c.id} onPress={() => setCategory(on ? '' : c.id)} style={[styles.cat, on && { backgroundColor: c.color, borderColor: c.color }]}>
              {!on ? <View style={[styles.dot, { backgroundColor: c.color }]} /> : null}
              <Text style={[styles.catText, on && styles.catTextOn]}>{c.name}</Text>
              <Text style={[styles.catCount, on && styles.catTextOn]}>{c.thread_count}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {COMMUNITY_SORTS.map((s) => (
            <Pressable key={s} onPress={() => setSort(s)} style={[styles.sort, sort === s && styles.sortOn]}>
              <Text style={[styles.sortText, sort === s && styles.sortTextOn]}>{COMMUNITY_SORT_LABELS[s]}</Text>
            </Pressable>
          ))}
        </ScrollView>
        <View style={styles.selects}>
          <Pressable style={styles.select} onPress={() => setPicker('filter')}>
            <Ionicons name="filter" size={14} color={colors.text} />
            <Text style={styles.selectText} numberOfLines={1}>
              {FILTER_LABELS[filter]}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
          <Pressable style={styles.select} onPress={() => setPicker('link')}>
            <Ionicons name="attach" size={14} color={colors.text} />
            <Text style={styles.selectText} numberOfLines={1}>
              {LINK_FILTERS.find((f) => f.value === linkType)?.label ?? 'Any tag'}
            </Text>
            <Ionicons name="chevron-down" size={14} color={colors.textMuted} />
          </Pressable>
        </View>
      </View>

      {!hasFilters && overview && overview.trending_tags.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="flame" size={15} color="#f97316" />
            <Text style={styles.sectionTitle}>Trending tags</Text>
          </View>
          <View style={styles.wrapRow}>
            {overview.trending_tags.map((t) => (
              <Pressable key={t.tag} onPress={() => setTag(t.tag)} style={styles.trend}>
                <Text style={styles.trendText}>
                  #{t.tag} <Text style={styles.trendCount}>{t.count}</Text>
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {!hasFilters && overview && overview.top_contributors.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Ionicons name="trophy" size={15} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Top helpers</Text>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
            {overview.top_contributors.map((a) => (
              <View key={a.id} style={styles.helper}>
                <Avatar id={a.id} initials={a.initials} size={36} />
                <Text style={styles.helperName} numberOfLines={1}>
                  {a.name}
                </Text>
                <Text style={styles.helperStat}>
                  {a.answers} answers{a.accepted > 0 ? ` · ${a.accepted} ✓` : ''}
                </Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {hasFilters ? (
        <View style={styles.wrapRow}>
          <Text style={styles.resultCount}>{loading ? 'Searching…' : `${total} result${total === 1 ? '' : 's'}`}</Text>
          {q ? (
            <ActiveChip
              label={`“${q}”`}
              onClear={() => {
                setSearch('');
                setQ('');
              }}
            />
          ) : null}
          {activeCat ? <ActiveChip label={activeCat.name} onClear={() => setCategory('')} /> : null}
          {tag ? <ActiveChip label={`#${tag}`} onClear={() => setTag('')} /> : null}
          {linkType ? <ActiveChip label={LINK_FILTERS.find((f) => f.value === linkType)?.label ?? linkType} onClear={() => setLinkType('')} /> : null}
          {filter !== 'all' ? <ActiveChip label={FILTER_LABELS[filter]} onClear={() => setFilter('all')} /> : null}
          <Pressable onPress={clearAll} hitSlop={6}>
            <Text style={styles.clearAll}>Clear all</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <Notice tone="error" icon="alert-circle" text={error} /> : null}
    </View>
  );

  return (
    <>
      <FlatList
        style={styles.root}
        data={loading ? [] : items}
        keyExtractor={(t) => t.id}
        renderItem={({ item }) => <ThreadCard t={item} />}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setReloadKey((k) => k + 1);
            }}
          />
        }
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={TEAL} style={styles.loader} />
          ) : error ? null : (
            <EmptyState
              icon="chatbubbles-outline"
              title={hasFilters ? 'No discussions match' : 'No discussions yet'}
              text={hasFilters ? 'Try another word or clear the filters.' : 'Be the first — ask a question or share something new with colleagues.'}
            />
          )
        }
        ListFooterComponent={
          more ? (
            <ActivityIndicator color={TEAL} style={styles.loader} />
          ) : !loading && items.length > 0 ? (
            <Text style={styles.guidelines}>
              Be respectful, share sources, and tag the related workflow, checklist or circular. Never post passwords, NID numbers or confidential data.
            </Text>
          ) : null
        }
      />
      <PickerSheet
        visible={picker === 'filter'}
        title="Show"
        options={(Object.keys(FILTER_LABELS) as CommunityFilter[]).map((f) => ({ value: f, label: FILTER_LABELS[f] }))}
        value={filter}
        onSelect={(o) => setFilter(o.value as CommunityFilter)}
        onClose={() => setPicker(null)}
      />
      <PickerSheet
        visible={picker === 'link'}
        title="Tagged item"
        options={LINK_FILTERS}
        value={linkType}
        clearLabel="Any tag"
        onSelect={(o) => setLinkType(o.value as CommunityLinkType | '')}
        onClose={() => setPicker(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.88,
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm + 4,
    paddingBottom: spacing.xl * 2,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  headerWrap: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  hero: {
    borderRadius: 22,
    padding: spacing.lg,
    gap: spacing.sm + 2,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  kickerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.white,
    lineHeight: 28,
  },
  heroSub: {
    fontSize: 13,
    lineHeight: 19,
    color: 'rgba(255,255,255,0.85)',
  },
  heroStats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroStat: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  heroStatNum: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.white,
  },
  heroActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: 2,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.white,
  },
  heroBtnRed: {
    backgroundColor: '#dc2626',
  },
  heroBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#115e59',
  },
  heroBtnTextRed: {
    color: colors.white,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
    borderRadius: 12,
    paddingHorizontal: spacing.sm + 4,
    minHeight: 46,
    backgroundColor: colors.white,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 8,
  },
  row: {
    gap: 6,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  cat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  catAll: {
    backgroundColor: colors.text,
    borderColor: colors.text,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  catText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  catCount: {
    fontSize: 11,
    color: colors.textMuted,
  },
  catTextOn: {
    color: colors.white,
  },
  toolbar: {
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sort: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortOn: {
    backgroundColor: '#ccfbf1',
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  sortTextOn: {
    color: '#115e59',
  },
  selects: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  select: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  section: {
    gap: spacing.sm,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  trend: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#f1f5f9',
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  trendCount: {
    color: colors.textMuted,
    fontWeight: '400',
  },
  helper: {
    width: 120,
    alignItems: 'center',
    gap: 4,
    padding: spacing.sm + 2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  helperName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
  },
  helperStat: {
    fontSize: 11,
    color: colors.textMuted,
  },
  resultCount: {
    fontSize: 13,
    color: colors.textMuted,
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: 200,
    borderRadius: 999,
    paddingLeft: 10,
    paddingRight: 6,
    paddingVertical: 4,
    backgroundColor: '#f1f5f9',
  },
  activeText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  clearAll: {
    fontSize: 12,
    fontWeight: '700',
    color: TEAL,
  },
  card: {
    gap: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardPinned: {
    borderColor: '#99f6e4',
    backgroundColor: '#f0fdfa',
  },
  cardHidden: {
    opacity: 0.7,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 5,
  },
  outline: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    color: colors.text,
  },
  excerpt: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  stats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm + 2,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  statAnswered: {
    backgroundColor: '#ecfdf5',
  },
  statSolved: {
    backgroundColor: colors.success,
  },
  statText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  statTextAnswered: {
    color: '#047857',
  },
  statTextSolved: {
    color: colors.white,
  },
  last: {
    flexShrink: 1,
    fontSize: 11,
    color: colors.textMuted,
  },
  guidelines: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
});
