import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BLOOD_GROUPS, donorGroupsFor, type BloodDonorRecord, type BloodGroup } from '@ibas/shared-types';
import { EmptyState } from '@/components/contacts/ContactBits';
import { SearchBar } from '@/components/ui/SearchBar';
import { SwitchRow } from '@/components/ui/SwitchRow';
import { Button } from '@/components/ui/Button';
import { BloodDrop, EligibilityBadge, ErrorNote, PlaceFields, RED, RED_BORDER, RED_SOFT, type Place } from '@/components/blood/BloodBits';
import { fetchDonors, sinceLabel } from '@/lib/blood-api';
import { whatsappUrl } from '@/lib/contacts-api';
import { formatDate } from '@/lib/profile-api';
import { useDebounced } from '@/hooks/useDebounced';
import { colors, spacing } from '@/theme';

const PAGE = 30;

export function DonorCard({ d }: { d: BloodDonorRecord }) {
  const location = [d.area, d.thana, d.district].filter(Boolean).join(', ');
  const wa = d.phone ? whatsappUrl(d.phone) : null;
  return (
    <View style={[styles.card, d.is_me && styles.cardMine]}>
      <View style={styles.cardHead}>
        <BloodDrop group={d.blood_group} />
        <View style={styles.flex}>
          <Text style={styles.name}>
            {d.name}
            {d.is_me ? <Text style={styles.you}>  You</Text> : null}
          </Text>
          {d.designation || d.office ? (
            <View style={styles.metaRow}>
              <Ionicons name="business-outline" size={12} color={colors.textMuted} />
              <Text style={styles.meta} numberOfLines={1}>
                {[d.designation, d.office].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}
          {location ? (
            <View style={styles.metaRow}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={styles.meta} numberOfLines={1}>
                {location}
              </Text>
            </View>
          ) : null}
        </View>
      </View>
      <View style={styles.badges}>
        <EligibilityBadge eligible={d.eligible} days={d.days_until_eligible} available={d.available} />
        {d.donation_count > 0 ? (
          <View style={styles.countPill}>
            <Ionicons name="ribbon" size={12} color="#be123c" />
            <Text style={styles.countText}>
              {d.donation_count} donation{d.donation_count === 1 ? '' : 's'}
            </Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.meta}>
        {sinceLabel(d.last_donation_date)}
        {!d.eligible && d.next_eligible_date ? ` · can donate from ${formatDate(d.next_eligible_date)}` : ''}
      </Text>
      <View style={styles.foot}>
        {d.phone ? (
          <>
            <Pressable
              style={({ pressed }) => [styles.callBtn, pressed && styles.pressed]}
              onPress={() => void Linking.openURL(`tel:${d.phone}`)}
              accessibilityLabel={`Call ${d.name}`}
            >
              <Ionicons name="call" size={16} color={colors.white} />
              <Text style={styles.callText}>Call {d.phone}</Text>
            </Pressable>
            {wa ? (
              <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]} onPress={() => void Linking.openURL(wa)} accessibilityLabel="WhatsApp">
                <Ionicons name="logo-whatsapp" size={18} color="#059669" />
              </Pressable>
            ) : null}
          </>
        ) : (
          <Text style={styles.meta}>Number kept private — post a request to reach this donor.</Text>
        )}
      </View>
    </View>
  );
}

/** Donor search: exact group or "compatible with patient", location, eligible-only. */
export function DonorList({ myGroup, initialGroup, header }: { myGroup: BloodGroup | null; initialGroup?: BloodGroup | ''; header: ReactElement }) {
  const [mode, setMode] = useState<'exact' | 'patient'>('exact');
  const [group, setGroup] = useState<BloodGroup | ''>(initialGroup ?? '');
  const [place, setPlace] = useState<Place>({ districtId: '', thanaId: '' });
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [query, setQuery] = useState('');
  const q = useDebounced(query.trim(), 300);

  const [items, setItems] = useState<BloodDonorRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialGroup !== undefined) setGroup(initialGroup);
  }, [initialGroup]);

  const load = useCallback(
    (p: number) =>
      fetchDonors({
        page: p,
        limit: PAGE,
        eligible: eligibleOnly,
        group: group && mode === 'exact' ? group : undefined,
        compatible_with: group && mode === 'patient' ? group : undefined,
        district_id: place.districtId || undefined,
        thana_id: place.thanaId || undefined,
        q: q || undefined,
      }),
    [mode, group, place.districtId, place.thanaId, eligibleOnly, q],
  );

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    load(1)
      .then((r) => {
        if (!live) return;
        setItems(r.data);
        setTotal(r.meta.total);
        setPage(1);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load donors'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [load]);

  async function loadMore() {
    if (more || loading || items.length >= total) return;
    setMore(true);
    try {
      const r = await load(page + 1);
      setItems((cur) => [...cur, ...r.data]);
      setTotal(r.meta.total);
      setPage(page + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more');
    } finally {
      setMore(false);
    }
  }

  const filters = (
    <View style={styles.filters}>
      <View style={styles.segment}>
        {(
          [
            ['exact', 'Donor group'],
            ['patient', 'Patient needs'],
          ] as const
        ).map(([m, label]) => (
          <Pressable key={m} onPress={() => setMode(m)} style={[styles.segBtn, mode === m && styles.segBtnOn]}>
            <Text style={[styles.segText, mode === m && styles.segTextOn]}>{label}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Pressable onPress={() => setGroup('')} style={[styles.chip, !group && styles.chipOn]}>
          <Text style={[styles.chipText, !group && styles.chipTextOn]}>All</Text>
        </Pressable>
        {BLOOD_GROUPS.map((g) => (
          <Pressable key={g} onPress={() => setGroup(g)} style={[styles.chip, group === g && styles.chipOn, g === myGroup && group !== g && styles.chipMine]}>
            <Text style={[styles.chipText, styles.chipGroup, group === g && styles.chipTextOn]}>{g}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {mode === 'patient' && group ? (
        <Text style={styles.compat}>
          A <Text style={styles.bold}>{group}</Text> patient can receive from: <Text style={styles.bold}>{donorGroupsFor(group).join(', ')}</Text>
        </Text>
      ) : null}
      <PlaceFields value={place} onChange={setPlace} />
      <SearchBar value={query} onChangeText={setQuery} placeholder="Search donors by name or area" />
      <SwitchRow
        label="Eligible donors only"
        hint="Hide donors who donated in the last 3 months or are unavailable."
        value={eligibleOnly}
        onChange={setEligibleOnly}
      />
    </View>
  );

  return (
    <FlatList
      data={loading ? [] : items}
      keyExtractor={(d) => d.id}
      renderItem={({ item }) => <DonorCard d={item} />}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.headerGap}>
          {header}
          {filters}
          <ErrorNote text={error} />
          {!loading && items.length > 0 ? (
            <Text style={styles.total}>
              {total} {eligibleOnly ? 'eligible ' : ''}donor{total === 1 ? '' : 's'}
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={RED} style={styles.loader} />
        ) : error ? null : (
          <EmptyState
            icon="water-outline"
            title={eligibleOnly ? 'No eligible donors found' : 'No donors found'}
            text={
              eligibleOnly
                ? 'Try another district, turn off "Eligible donors only", or post a blood request so matching donors are notified.'
                : 'Try another blood group or district.'
            }
          />
        )
      }
      ListFooterComponent={
        more ? (
          <ActivityIndicator color={RED} style={styles.loader} />
        ) : !loading && items.length < total ? (
          <Button title={`Load more (${total - items.length} left)`} variant="secondary" onPress={() => void loadMore()} />
        ) : null
      }
    />
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 0,
  },
  pressed: {
    opacity: 0.85,
  },
  bold: {
    fontWeight: '800',
  },
  list: {
    padding: spacing.md,
    gap: spacing.sm + 4,
    paddingBottom: spacing.xl * 2,
  },
  headerGap: {
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  loader: {
    marginVertical: spacing.lg,
  },
  total: {
    fontSize: 13,
    color: colors.textMuted,
  },
  filters: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  segment: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: 2,
    alignSelf: 'flex-start',
  },
  segBtn: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  segBtnOn: {
    backgroundColor: RED,
  },
  segText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  segTextOn: {
    color: colors.white,
  },
  chips: {
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  chipOn: {
    backgroundColor: RED,
    borderColor: RED,
  },
  chipMine: {
    borderColor: '#fca5a5',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  chipGroup: {
    color: '#b91c1c',
  },
  chipTextOn: {
    color: colors.white,
  },
  compat: {
    fontSize: 12,
    color: '#7f1d1d',
    backgroundColor: RED_SOFT,
    borderRadius: 10,
    padding: spacing.sm + 2,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm + 2,
  },
  cardMine: {
    borderColor: RED_BORDER,
    borderWidth: 1.5,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm + 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  you: {
    fontSize: 11,
    fontWeight: '800',
    color: RED,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  meta: {
    flexShrink: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  countPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: '#fff1f2',
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#be123c',
  },
  foot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm + 2,
  },
  callBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 40,
    borderRadius: 10,
    backgroundColor: RED,
  },
  callText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.white,
    fontVariant: ['tabular-nums'],
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
