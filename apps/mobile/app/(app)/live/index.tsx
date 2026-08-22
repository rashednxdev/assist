import { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
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

function sortByCurrentDateFirst(items: LiveStreamListItem[]) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const startMs = start.getTime();
  const endMs = end.getTime();
  const today: LiveStreamListItem[] = [];
  const future: LiveStreamListItem[] = [];
  const past: LiveStreamListItem[] = [];
  for (const item of items) {
    const t = new Date(item.scheduled_at).getTime();
    if (t >= startMs && t < endMs) today.push(item);
    else if (t >= endMs) future.push(item);
    else past.push(item);
  }
  const byAsc = (a: LiveStreamListItem, b: LiveStreamListItem) =>
    new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
  const byDesc = (a: LiveStreamListItem, b: LiveStreamListItem) =>
    new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime();
  today.sort(byAsc);
  future.sort(byAsc);
  past.sort(byDesc);
  return [...today, ...future, ...past];
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
      const rows = await fetchLiveStreams();
      setItems(sortByCurrentDateFirst(rows));
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

  if (loading && items.length === 0) return <BookLoading />;
  if (error && items.length === 0) return <BookError message={error} />;

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        ListEmptyComponent={
          <BookEmpty title="No live sessions" subtitle="When an admin schedules a class, it will show up here." />
        }
        renderItem={({ item }) => {
          const perm = permissionMeta(item.permission_status);
          return (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
              onPress={() => router.push(`/(app)/live/${item.id}` as never)}
            >
              <View style={styles.iconWrap}>
                <Ionicons name="videocam" size={22} color="#be185d" />
              </View>
              <View style={styles.body}>
                <Text style={styles.topic}>{item.topic}</Text>
                <Text style={styles.when}>{formatWhen(item.scheduled_at)}</Text>
                <View style={styles.badges}>
                  <View style={styles.statusBadge}>
                    <Text style={styles.statusText}>{item.status}</Text>
                  </View>
                  <View style={[styles.permBadge, { backgroundColor: perm.bg }]}>
                    <Text style={[styles.permText, { color: perm.color }]}>{perm.label}</Text>
                  </View>
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
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
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
});
