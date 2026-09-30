import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { BloodMe, BloodRequestRecord } from '@ibas/shared-types';
import { EmptyState } from '@/components/contacts/ContactBits';
import { Button } from '@/components/ui/Button';
import { BloodDrop, ErrorNote, PlaceFields, RED, StatusBadge, Tag, UrgencyBadge } from '@/components/blood/BloodBits';
import { fetchRequests, formatDateTime, type RequestScope } from '@/lib/blood-api';
import { colors, spacing } from '@/theme';

export function requestHref(id: string): Href {
  return `/(app)/blood-bank/requests/${id}` as Href;
}

export function RequestCard({ r }: { r: BloodRequestRecord }) {
  const router = useRouter();
  const place = [r.thana?.name, r.district?.name].filter(Boolean).join(', ');
  const critical = r.urgency === 'critical' && r.status === 'open';
  return (
    <Pressable
      onPress={() => router.push(requestHref(r.id))}
      style={({ pressed }) => [styles.card, critical && styles.cardCritical, pressed && styles.pressed]}
    >
      <View style={styles.dropCol}>
        <BloodDrop group={r.blood_group} size="lg" />
        <Text style={styles.units}>
          {r.units} bag{r.units === 1 ? '' : 's'}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.tags}>
          {r.status === 'open' ? <UrgencyBadge urgency={r.urgency} /> : <StatusBadge status={r.status} />}
          {r.is_mine ? <Tag text="Your request" tone="dark" /> : null}
          {r.i_responded ? <Tag text="You offered" tone="red" /> : null}
          {r.status === 'open' && r.compatible && !r.is_mine && !r.i_responded ? <Tag text="You can help" tone="green" /> : null}
        </View>
        <View style={styles.row}>
          <Ionicons name="medkit" size={15} color={RED} />
          <Text style={styles.hospital} numberOfLines={1}>
            {r.hospital}
          </Text>
        </View>
        <View style={styles.row}>
          <Ionicons name="time-outline" size={13} color={colors.textMuted} />
          <Text style={styles.meta}>Needed {formatDateTime(r.needed_on)}</Text>
        </View>
        {place ? (
          <View style={styles.row}>
            <Ionicons name="location-outline" size={13} color={colors.textMuted} />
            <Text style={styles.meta} numberOfLines={1}>
              {place}
            </Text>
          </View>
        ) : null}
        <View style={styles.row}>
          <Ionicons name="people-outline" size={13} color={colors.textMuted} />
          <Text style={styles.meta}>
            {r.response_count} offer{r.response_count === 1 ? '' : 's'}
            {r.patient_name ? ` · Patient: ${r.patient_name}` : ''}
          </Text>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#cbd5e1" />
    </Pressable>
  );
}

const SCOPES: Array<{ id: RequestScope; label: string }> = [
  { id: 'open', label: 'All open' },
  { id: 'can_help', label: 'I can help' },
  { id: 'mine', label: 'My requests' },
  { id: 'responded', label: 'I offered' },
  { id: 'closed', label: 'Closed' },
];

export function RequestList({ me, header, onNew, reloadKey }: { me: BloodMe; header: ReactElement; onNew: () => void; reloadKey: number }) {
  const [scope, setScope] = useState<RequestScope>(me.blood_group ? 'can_help' : 'open');
  const [districtId, setDistrictId] = useState('');
  const [items, setItems] = useState<BloodRequestRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback((p: number) => fetchRequests({ scope, district_id: districtId || undefined, page: p, limit: 20 }), [scope, districtId]);

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
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load requests'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [load, reloadKey]);

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

  return (
    <FlatList
      data={loading ? [] : items}
      keyExtractor={(r) => r.id}
      renderItem={({ item }) => <RequestCard r={item} />}
      contentContainerStyle={styles.list}
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.4}
      ListHeaderComponent={
        <View style={styles.headerGap}>
          {header}
          <View style={styles.filters}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {SCOPES.map((s) => (
                <Pressable key={s.id} onPress={() => setScope(s.id)} style={[styles.chip, scope === s.id && styles.chipOn]}>
                  <Text style={[styles.chipText, scope === s.id && styles.chipTextOn]}>{s.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <PlaceFields value={{ districtId, thanaId: '' }} onChange={(p) => setDistrictId(p.districtId)} showThana={false} />
            <Button title="Request blood" onPress={onNew} style={{ backgroundColor: RED, height: 46 }} />
          </View>
          <ErrorNote text={error} />
        </View>
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={RED} style={styles.loader} />
        ) : error ? null : (
          <EmptyState
            icon="megaphone-outline"
            title={scope === 'mine' ? 'You haven’t requested blood' : scope === 'can_help' ? 'No open requests for your blood group' : 'No requests here'}
            text={scope === 'can_help' ? 'You’ll get a notification when someone nearby needs your blood group (if you’re a donor).' : undefined}
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
  pressed: {
    opacity: 0.88,
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
  filters: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  chips: {
    gap: 6,
  },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  chipOn: {
    backgroundColor: RED,
    borderColor: RED,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  chipTextOn: {
    color: colors.white,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardCritical: {
    borderColor: '#fca5a5',
    borderWidth: 1.5,
  },
  dropCol: {
    alignItems: 'center',
    gap: 6,
  },
  units: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  hospital: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    flexShrink: 1,
    fontSize: 12,
    color: colors.textMuted,
  },
});
