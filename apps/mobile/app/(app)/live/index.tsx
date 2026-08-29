import { useCallback, useLayoutEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, SectionList, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { fetchLiveStreams, type LiveStreamListItem } from '@/lib/live-stream-api';
import { colors, spacing } from '@/theme';

type LiveScope = 'all' | 'upcoming' | 'previous';

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

function parseScope(raw: string | string[] | undefined): LiveScope {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === 'upcoming' || v === 'previous') return v;
  return 'all';
}

export default function LiveStreamListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ scope?: string }>();
  const scope = parseScope(params.scope);
  const [items, setItems] = useState<LiveStreamListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    navigation.setOptions({
      title:
        scope === 'previous'
          ? 'Previous class'
          : scope === 'upcoming'
            ? 'Live class'
            : 'Live class',
    });
  }, [navigation, scope]);

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
    const out: Array<{
      key: 'upcoming' | 'previous';
      title: string;
      hint: string;
      data: LiveStreamListItem[];
    }> = [];
    if (scope !== 'previous' && upcoming.length) {
      out.push({
        key: 'upcoming',
        title: 'Upcoming & live',
        hint: 'Join when the class is live',
        data: upcoming,
      });
    }
    if (scope !== 'upcoming' && previous.length) {
      out.push({
        key: 'previous',
        title: 'Previous classes',
        hint: 'Recordings, slides & presentations',
        data: previous,
      });
    }
    return out;
  }, [items, scope]);

  if (loading && items.length === 0) return <BookLoading />;
  if (error && items.length === 0) return <BookError message={error} />;

  const emptyTitle =
    scope === 'previous'
      ? 'No previous classes'
      : scope === 'upcoming'
        ? 'No upcoming classes'
        : 'No live sessions';
  const emptySubtitle =
    scope === 'previous'
      ? 'When a live class ends, it appears here with recordings and presentations.'
      : scope === 'upcoming'
        ? 'Scheduled and live classes will show here. Joining still needs an invite.'
        : 'When an admin schedules a live class, it will show up here. Joining still needs an invite.';

  return (
    <View style={styles.root}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}
        ListEmptyComponent={<BookEmpty title={emptyTitle} subtitle={emptySubtitle} />}
        renderSectionHeader={({ section }) => (
          <View
            style={[
              styles.sectionHeader,
              section.key === 'previous' ? styles.sectionHeaderPrevious : styles.sectionHeaderUpcoming,
            ]}
          >
            <View style={styles.sectionTitleRow}>
              <Ionicons
                name={section.key === 'previous' ? 'albums' : 'radio'}
                size={16}
                color={section.key === 'previous' ? '#9d174d' : '#0369a1'}
              />
              <Text
                style={[
                  styles.sectionTitle,
                  section.key === 'previous' ? styles.sectionTitlePrevious : styles.sectionTitleUpcoming,
                ]}
              >
                {section.title}
              </Text>
            </View>
            <Text style={styles.sectionHint}>{section.hint}</Text>
          </View>
        )}
        renderItem={({ item, section }) => {
          const previous = section.key === 'previous';
          const perm = permissionMeta(item.permission_status);
          const liveNow = !previous && item.status === 'live';
          return (
            <Pressable
              style={({ pressed }) => [
                styles.card,
                previous ? styles.cardPrevious : styles.cardUpcoming,
                liveNow && styles.cardLive,
                pressed && styles.pressed,
              ]}
              onPress={() => router.push(`/(app)/live/${item.id}` as never)}
            >
              <View
                style={[
                  styles.iconWrap,
                  previous ? styles.iconWrapPrevious : styles.iconWrapUpcoming,
                  liveNow && styles.iconWrapLive,
                ]}
              >
                <Ionicons
                  name={previous ? 'play-circle-outline' : liveNow ? 'radio' : 'videocam'}
                  size={22}
                  color={previous ? '#9d174d' : liveNow ? '#047857' : '#0369a1'}
                />
              </View>
              <View style={styles.body}>
                <Text style={styles.topic}>{item.topic}</Text>
                <Text style={styles.when}>{formatWhen(item.scheduled_at)}</Text>
                <View style={styles.badges}>
                  <View
                    style={[
                      styles.statusBadge,
                      previous ? styles.statusBadgePrevious : liveNow ? styles.statusBadgeLive : styles.statusBadgeUpcoming,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusText,
                        previous
                          ? styles.statusTextPrevious
                          : liveNow
                            ? styles.statusTextLive
                            : styles.statusTextUpcoming,
                      ]}
                    >
                      {previous ? 'Previous' : liveNow ? 'Live now' : item.status}
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
                        {item.permission_status === 'not_permitted' ? 'View only' : 'Replay open'}
                      </Text>
                    </View>
                  )}
                  {(item.recorded_content_count ?? 0) > 0 ? (
                    <View style={styles.recordBadge}>
                      <Text style={styles.recordBadgeText}>
                        {item.recorded_content_count} video
                        {(item.recorded_content_count ?? 0) === 1 ? '' : 's'}
                      </Text>
                    </View>
                  ) : null}
                  {(item.presentation_count ?? 0) > 1 ? (
                    <View style={styles.slidesBadge}>
                      <Text style={styles.slidesBadgeText}>
                        {item.presentation_count} presentations
                      </Text>
                    </View>
                  ) : (item.slide_count ?? 0) > 0 ? (
                    <View style={styles.slidesBadge}>
                      <Text style={styles.slidesBadgeText}>
                        {item.slide_count} slide{(item.slide_count ?? 0) === 1 ? '' : 's'}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <Ionicons
                name={previous ? 'play' : 'chevron-forward'}
                size={18}
                color={previous ? '#9d174d' : colors.textMuted}
              />
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
  sectionHeader: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: spacing.sm,
    marginBottom: 8,
    gap: 2,
  },
  sectionHeaderUpcoming: {
    backgroundColor: '#e0f2fe',
    borderWidth: 1,
    borderColor: '#7dd3fc',
  },
  sectionHeaderPrevious: {
    backgroundColor: '#fce7f3',
    borderWidth: 1,
    borderColor: '#f9a8d4',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  sectionTitleUpcoming: { color: '#0369a1' },
  sectionTitlePrevious: { color: '#9d174d' },
  sectionHint: { fontSize: 12, color: colors.textMuted, marginLeft: 22 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: 10,
  },
  cardUpcoming: {
    backgroundColor: '#f0f9ff',
    borderColor: '#bae6fd',
  },
  cardPrevious: {
    backgroundColor: '#fff7fb',
    borderColor: '#fbcfe8',
  },
  cardLive: {
    backgroundColor: '#ecfdf5',
    borderColor: '#6ee7b7',
  },
  pressed: { opacity: 0.92 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapUpcoming: { backgroundColor: '#e0f2fe' },
  iconWrapPrevious: { backgroundColor: '#fce7f3' },
  iconWrapLive: { backgroundColor: '#d1fae5' },
  body: { flex: 1, gap: 4 },
  topic: { fontSize: 15, fontWeight: '800', color: colors.text },
  when: { fontSize: 12, color: colors.textMuted },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  statusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  statusBadgeUpcoming: { backgroundColor: '#e0f2fe', borderColor: '#7dd3fc' },
  statusBadgePrevious: { backgroundColor: '#fce7f3', borderColor: '#f9a8d4' },
  statusBadgeLive: { backgroundColor: '#d1fae5', borderColor: '#6ee7b7' },
  statusText: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  statusTextUpcoming: { color: '#0369a1' },
  statusTextPrevious: { color: '#9d174d' },
  statusTextLive: { color: '#047857' },
  permBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  permText: { fontSize: 10, fontWeight: '800' },
  slidesBadge: {
    borderRadius: 999,
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  slidesBadgeText: { fontSize: 10, fontWeight: '800', color: '#9d174d' },
  recordBadge: {
    borderRadius: 999,
    backgroundColor: '#ede9fe',
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  recordBadgeText: { fontSize: 10, fontWeight: '800', color: '#6d28d9' },
});
