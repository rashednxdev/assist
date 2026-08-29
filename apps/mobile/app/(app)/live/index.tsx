import { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { fetchLiveStreams, type LiveStreamListItem } from '@/lib/live-stream-api';
import { colors, spacing } from '@/theme';

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function permissionMeta(status: LiveStreamListItem['permission_status']) {
  if (status === 'not_permitted') return { label: 'Not permitted', bg: '#fff1f2', color: '#be123c' };
  return { label: 'Permitted', bg: '#ecfdf5', color: '#047857' };
}

function isPreviousItem(item: LiveStreamListItem) {
  if (typeof item.is_previous === 'boolean') return item.is_previous;
  if (item.status === 'ended' || item.status === 'cancelled') return true;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return new Date(item.scheduled_at).getTime() < start.getTime();
}

function sortUpcoming(items: LiveStreamListItem[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const today: LiveStreamListItem[] = [];
  const future: LiveStreamListItem[] = [];
  for (const item of items) {
    const t = new Date(item.scheduled_at).getTime();
    if (t >= startMs && t < endMs) today.push(item);
    else future.push(item);
  }
  const byAsc = (a: LiveStreamListItem, b: LiveStreamListItem) =>
    new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  today.sort(byAsc);
  future.sort(byAsc);
  return [...today, ...future];
}

function sortPrevious(items: LiveStreamListItem[]) {
  return [...items].sort(
    (a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime(),
  );
}

export default function LiveStreamListScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LiveStreamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (soft = false) => {
    if (soft) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setItems(await fetchLiveStreams('zoom'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const sections = useMemo(() => {
    const upcoming = sortUpcoming(items.filter((i) => !isPreviousItem(i)));
    const previous = sortPrevious(items.filter((i) => isPreviousItem(i)));
    const out: Array<{ title: string; data: LiveStreamListItem[] }> = [];
    if (upcoming.length) out.push({ title: 'Upcoming & live', data: upcoming });
    if (previous.length) out.push({ title: 'Previous class', data: previous });
    return out;
  }, [items]);

  if (loading && items.length === 0) return <BookLoading />;
  if (error && items.length === 0) return <BookError message={error} />;

  return (
    <View style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        ListEmptyComponent={
          <BookEmpty
            title="No live sessions"
            subtitle="When an admin schedules a live class, it will show up here. Joining still needs an invite."
          />
        }
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionTitle}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => {
          const previous = section.title === 'Previous class';
          const perm = permissionMeta(item.permission_status);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, previous && styles.cardPrevious, pressed && styles.pressed]}
              onPress={() => router.push(`/(app)/live/${item.id}` as never)}
            >
              <View style={[styles.iconWrap, previous && styles.iconWrapPrevious]}>
                <Ionicons
                  name={previous ? 'albums-outline' : 'videocam'}
                  size={22}
                  color={previous ? '#9d174d' : '#be185d'}
                />
              </View>
              <View style={styles.body}>
                <Text style={styles.topic}>{item.topic}</Text>
                <Text style={styles.when}>{formatWhen(item.scheduled_at)}</Text>
                <View style={styles.badges}>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>
                      {previous ? 'Previous' : item.status}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.permBadge,
                      {
                        backgroundColor: item.access_type === 'paid' ? '#fffbeb' : '#ecfdf5',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.permText,
                        { color: item.access_type === 'paid' ? '#b45309' : '#047857' },
                      ]}
                    >
                      {item.access_type === 'paid' ? 'Paid' : 'Free'}
                    </Text>
                  </View>
                  {!previous ? (
                    <View style={[styles.permBadge, { backgroundColor: perm.bg }]}>
                      <Text style={[styles.permText, { color: perm.color }]}>{perm.label}</Text>
                    </View>
                  ) : (
                    <View style={[styles.permBadge, { backgroundColor: perm.bg }]}>
                      <Text style={[styles.permText, { color: perm.color }]}>
                        {item.permission_status === 'not_permitted' ? 'View only' : 'Access open'}
                      </Text>
                    </View>
                  )}
                  {(item.slide_count ?? 0) > 0 ? (
                    <View style={styles.slidesBadge}>
                      <Text style={styles.slidesBadgeText}>
                        {item.slide_count} slide{(item.slide_count ?? 0) === 1 ? '' : 's'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.md, paddingBottom: spacing.xl, gap: 10 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: 10,
  },
  cardPrevious: {
    borderColor: '#fbcfe8',
    backgroundColor: '#fff7fb',
  },
  pressed: { opacity: 0.92 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fdf2f8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapPrevious: { backgroundColor: '#fce7f3' },
  body: { flex: 1, gap: 4 },
  topic: { fontSize: 15, fontWeight: '800', color: colors.text },
  when: { fontSize: 12, color: colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  statusBadge: {
    borderRadius: 999,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  permBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  permText: { fontSize: 10, fontWeight: '800' },
  slidesBadge: {
    borderRadius: 999,
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  slidesBadgeText: { fontSize: 10, fontWeight: '800', color: '#9d174d' },
});
