import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BATCH_WINDOW_MONTHS,
  type BatchDirectory,
  type BatchGroup,
  type ContactEmployee,
  type MyBatch,
} from '@ibas/shared-types';
import { Chip, EmployeeCard, EmptyState } from '@/components/contacts/ContactBits';
import { ServiceInfoForm } from '@/components/org/ServiceInfoForm';
import { FormScroll } from '@/components/ui/FormScroll';
import { Panel } from '@/components/ui/Panel';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { SearchBar } from '@/components/ui/SearchBar';
import { fetchBatches, fetchBatchMembers, fetchMyBatch } from '@/lib/contacts-api';
import { formatDate } from '@/lib/profile-api';
import { colors, spacing } from '@/theme';

function dateRange(g: BatchGroup): string {
  if (!g.from) return '';
  const from = formatDate(g.from);
  const to = g.to ? formatDate(g.to) : from;
  return from === to ? `Joined ${from}` : `Joined ${from} – ${to}`;
}

function subtitle(g: BatchGroup): string {
  const people = `${g.count} ${g.count === 1 ? 'member' : 'members'}`;
  return g.kind === 'cadre' ? `BCS cadre batch · ${people}` : `${dateRange(g)} · ${people}`;
}

function matches(m: ContactEmployee, q: string): boolean {
  return [m.name, m.name_bn, m.designation?.name, m.designation?.short_name, m.office?.name, m.office?.short_name].some((s) =>
    s?.toLowerCase().includes(q),
  );
}

export function Batchmates() {
  const [mine, setMine] = useState<MyBatch | null>(null);
  const [dir, setDir] = useState<BatchDirectory | null>(null);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [kind, setKind] = useState<'cadre' | 'non_cadre'>('cadre');
  const [postFilter, setPostFilter] = useState('');
  const [pickPost, setPickPost] = useState(false);
  const [selected, setSelected] = useState<{ group: BatchGroup; members: ContactEmployee[] } | null>(null);
  const [loadingKey, setLoadingKey] = useState('');
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [m, d] = await Promise.all([fetchMyBatch(), fetchBatches()]);
      setMine(m);
      setDir(d);
      if (m.info.service_type) setKind(m.info.service_type);
      else if (!d.cadre.length && d.non_cadre.length) setKind('non_cadre');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load batches');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(g: BatchGroup) {
    if (selected?.group.key === g.key) return setSelected(null);
    setLoadingKey(g.key);
    setQuery('');
    try {
      const r = await fetchBatchMembers(g.key);
      setSelected(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load members');
    } finally {
      setLoadingKey('');
    }
  }

  const posts = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of dir?.non_cadre ?? []) if (g.designation) m.set(g.designation.id, g.title);
    return [...m.entries()].map(([value, label]) => ({ value, label }));
  }, [dir]);

  const viewing = selected ?? (mine?.group ? { group: mine.group, members: mine.members } : null);
  const shown = useMemo(() => {
    const list = viewing?.members ?? [];
    const needle = query.trim().toLowerCase();
    return needle ? list.filter((m) => matches(m, needle)) : list;
  }, [viewing, query]);

  if (error && !mine) {
    return <EmptyState icon="cloud-offline-outline" title="Could not load batches" text={error} />;
  }
  if (!mine || !dir) return <ActivityIndicator color={colors.primary} style={styles.loader} />;

  const saved = () => {
    setEditing(false);
    setSelected(null);
    void load();
  };

  if (!mine.info.complete || editing) {
    return (
      <FormScroll>
        <Panel
          icon="school-outline"
          title={mine.info.complete ? 'Edit service information' : 'Find your batchmates'}
          subtitle="Tell us how you joined the service. Cadre officers are grouped by BCS batch; others by the post they joined and when."
          right={
            editing && mine.info.complete ? (
              <Pressable onPress={() => setEditing(false)} hitSlop={10} accessibilityLabel="Cancel">
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </Pressable>
            ) : undefined
          }
        >
          <ServiceInfoForm submitLabel={mine.info.complete ? 'Save' : 'Show my batch'} onSaved={saved} />
        </Panel>
      </FormScroll>
    );
  }

  const cohorts = postFilter ? dir.non_cadre.filter((g) => g.designation?.id === postFilter) : dir.non_cadre;
  const g = mine.group;

  const header = (
    <View style={styles.header}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name={mine.info.service_type === 'cadre' ? 'ribbon' : 'briefcase'} size={22} color={colors.white} />
        </View>
        <View style={styles.heroText}>
          <Text style={styles.heroEyebrow}>YOUR BATCH</Text>
          <Text style={styles.heroTitle}>{g ? g.title : 'Not grouped yet'}</Text>
          {g ? <Text style={styles.heroSub}>{subtitle(g)}</Text> : null}
        </View>
        <Pressable onPress={() => setEditing(true)} hitSlop={8} style={styles.editBtn} accessibilityLabel="Edit service information">
          <Ionicons name="create-outline" size={18} color={colors.primary} />
        </Pressable>
      </View>

      <View style={styles.browse}>
        <Text style={styles.sectionTitle}>Browse batches</Text>
        <Text style={styles.sectionHint}>
          Non-cadre batches are people who joined the same post within {BATCH_WINDOW_MONTHS} months of the batch’s first joiner.
        </Text>
        <View style={styles.segment}>
          {(
            [
              ['cadre', 'BCS batches', dir.cadre.length],
              ['non_cadre', 'By joining post', dir.non_cadre.length],
            ] as const
          ).map(([k, label, n]) => (
            <Pressable key={k} onPress={() => setKind(k)} style={[styles.segBtn, kind === k && styles.segBtnActive]}>
              <Text style={[styles.segText, kind === k && styles.segTextActive]}>
                {label} ({n})
              </Text>
            </Pressable>
          ))}
        </View>

        {kind === 'cadre' ? (
          dir.cadre.length ? (
            <View style={styles.chipWrap}>
              {dir.cadre.map((b) => (
                <Chip
                  key={b.key}
                  label={loadingKey === b.key ? 'Loading…' : b.is_mine ? `${b.title} · You` : b.title}
                  count={b.count}
                  active={viewing?.group.key === b.key}
                  onPress={() => void open(b)}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.sectionHint}>No BCS batches yet. Batches appear as cadre officers add their BCS batch.</Text>
          )
        ) : dir.non_cadre.length ? (
          <View style={styles.rows}>
            {posts.length > 1 ? (
              <SelectField
                label="Joining post"
                display={posts.find((p) => p.value === postFilter)?.label ?? ''}
                placeholder="All posts"
                onPress={() => setPickPost(true)}
              />
            ) : null}
            {cohorts.map((c) => {
              const active = viewing?.group.key === c.key;
              return (
                <Pressable key={c.key} onPress={() => void open(c)} style={[styles.row, active && styles.rowActive]}>
                  <Ionicons name="calendar-outline" size={18} color={active ? colors.primary : colors.textMuted} />
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle} numberOfLines={1}>
                      {c.title}
                      {c.designation?.grade != null ? <Text style={styles.rowGrade}>{`  Grade ${c.designation.grade}`}</Text> : null}
                      {c.is_mine ? <Text style={styles.rowYou}>{'  You'}</Text> : null}
                    </Text>
                    <Text style={styles.rowSub}>{dateRange(c)}</Text>
                  </View>
                  {loadingKey === c.key ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <View style={styles.count}>
                      <Text style={styles.countText}>{c.count}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.sectionHint}>No non-cadre batches yet. Batches appear as members add their joining post and date.</Text>
        )}
      </View>

      {viewing ? (
        <View style={styles.membersHead}>
          <View style={styles.flex}>
            <Text style={styles.sectionTitle}>{selected ? viewing.group.title : 'Your batchmates'}</Text>
            <Text style={styles.sectionHint}>{subtitle(viewing.group)}</Text>
          </View>
          {selected ? (
            <Pressable onPress={() => setSelected(null)} hitSlop={8} style={styles.backChip}>
              <Ionicons name="arrow-undo-outline" size={14} color={colors.primary} />
              <Text style={styles.backChipText}>My batch</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {viewing && viewing.members.length > 9 ? (
        <SearchBar value={query} onChangeText={setQuery} placeholder="Filter by name, designation or office" />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );

  return (
    <>
      <FlatList
        data={shown}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => <EmployeeCard e={item} />}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title={query ? `No one matches “${query}”` : 'No batchmates yet'}
            text={query ? undefined : 'No one else from this batch has joined yet.'}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              setSelected(null);
              await load();
              setRefreshing(false);
            }}
          />
        }
      />
      <PickerSheet
        visible={pickPost}
        title="Joining post"
        clearLabel="All posts"
        value={postFilter}
        options={posts}
        onSelect={(o) => setPostFilter(o.value)}
        onClose={() => setPickPost(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loader: {
    paddingVertical: spacing.xl,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm + 4,
    paddingBottom: spacing.xl * 2,
  },
  header: {
    gap: spacing.md,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    backgroundColor: '#e8f2fa',
    borderWidth: 1,
    borderColor: '#bfdbf0',
    borderRadius: 16,
    padding: spacing.md,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroText: {
    flex: 1,
    gap: 2,
  },
  heroEyebrow: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: colors.primaryDark,
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: colors.text,
  },
  heroSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  editBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  browse: {
    gap: spacing.sm + 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  sectionHint: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#e2e8f0',
    borderRadius: 12,
    padding: 3,
  },
  segBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 9,
  },
  segBtnActive: {
    backgroundColor: colors.surface,
  },
  segText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segTextActive: {
    color: colors.text,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  rows: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm + 4,
  },
  rowActive: {
    borderColor: colors.primary,
    backgroundColor: '#e8f2fa',
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  rowGrade: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textMuted,
  },
  rowYou: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.primary,
  },
  rowSub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  count: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    backgroundColor: '#f1f5f9',
  },
  countText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  membersHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  backChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  backChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  error: {
    fontSize: 13,
    color: colors.error,
  },
});
