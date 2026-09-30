import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { scheduleKindColor, scheduleKindLabel, type CircularRecord, type MyAccessSummary, type ScheduleOccurrence } from '@ibas/shared-types';
import { useAuth } from '@/lib/auth-context';
import { canReadAnyModule } from '@/lib/module-access';
import { fetchScheduleFeed, formatDayShort, occurrenceTimeText } from '@/lib/schedule-api';
import { CIRCULAR_MODULE_CODES, EMPTY_CIRCULAR_FILTERS, fetchCirculars } from '@/lib/circulars-api';
import { daysLeft, fetchMyAccess } from '@/lib/billing-api';
import { colors, spacing } from '@/theme';

const WEEK_DAYS = 7;
const LOOKAHEAD_DAYS = 30;

function localIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function dayWord(date: string, today: string, tomorrow: string): string {
  if (date === today) return 'Today';
  if (date === tomorrow) return 'Tomorrow';
  return formatDayShort(date);
}

interface Summary {
  upcoming: ScheduleOccurrence[];
  weekCount: number;
  circular: { latest: CircularRecord | null; total: number } | null;
  access: MyAccessSummary | null;
}

interface HomeSummaryCardProps {
  unreadCount: number;
  /** Bump to reload, e.g. on pull-to-refresh. */
  refreshKey: number;
}

/** Home "At a glance" card: next office events, latest circular, alerts and paid access. */
export function HomeSummaryCard({ unreadCount, refreshKey }: HomeSummaryCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const canCirculars = canReadAnyModule(user, CIRCULAR_MODULE_CODES);
  const [data, setData] = useState<Summary | null>(null);

  const now = new Date();
  const today = localIso(now);
  const tomorrow = localIso(addDays(now, 1));

  const load = useCallback(async () => {
    const start = new Date();
    const from = localIso(start);
    const weekEnd = localIso(addDays(start, WEEK_DAYS - 1));
    const [feed, circ, access] = await Promise.all([
      fetchScheduleFeed(from, localIso(addDays(start, LOOKAHEAD_DAYS))).catch(() => [] as ScheduleOccurrence[]),
      canCirculars ? fetchCirculars(EMPTY_CIRCULAR_FILTERS, 'newest', 0, 1).catch(() => null) : Promise.resolve(null),
      fetchMyAccess().catch(() => null),
    ]);
    const upcoming = feed
      .filter((o) => o.status !== 'cancelled' && o.date >= from)
      .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));
    setData({
      upcoming,
      weekCount: upcoming.filter((o) => o.date <= weekEnd).length,
      circular: circ ? { latest: circ.items[0] ?? null, total: circ.total } : null,
      access,
    });
  }, [canCirculars]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  useEffect(() => {
    if (refreshKey > 0) void load();
  }, [refreshKey, load]);

  const next = data?.upcoming.slice(0, 2) ?? [];
  const todayCount = data?.upcoming.filter((o) => o.date === today).length ?? 0;
  const basicDays = data?.access?.basic_until ? daysLeft(data.access.basic_until) : null;
  const examDays = data?.access?.exam_prep_until ? daysLeft(data.access.exam_prep_until) : null;
  const dateLabel = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headIcon}>
          <Ionicons name="today-outline" size={18} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <Text style={styles.heading}>At a glance</Text>
          <Text style={styles.sub}>{dateLabel}</Text>
        </View>
        {todayCount > 0 ? (
          <View style={styles.todayPill}>
            <Text style={styles.todayPillText}>{todayCount} today</Text>
          </View>
        ) : null}
      </View>

      <Pressable
        style={({ pressed }) => [styles.upcoming, pressed && styles.pressed]}
        onPress={() => router.push('/(app)/schedule' as Href)}
        accessibilityRole="button"
        accessibilityLabel="Open schedule"
      >
        <View style={styles.upcomingHead}>
          <Text style={styles.blockTitle}>Coming up</Text>
          <Ionicons name="chevron-forward" size={14} color={colors.textMuted} />
        </View>
        {!data ? (
          <Text style={styles.muted}>Loading…</Text>
        ) : next.length === 0 ? (
          <Text style={styles.muted}>Nothing scheduled in the next {LOOKAHEAD_DAYS} days.</Text>
        ) : (
          next.map((o) => {
            const tint = scheduleKindColor(o.kind);
            return (
              <View key={`${o.event_id}-${o.date}`} style={styles.eventRow}>
                <View style={[styles.eventBar, { backgroundColor: tint }]} />
                <View style={styles.flex}>
                  <Text style={styles.eventTitle} numberOfLines={1}>
                    {o.title}
                  </Text>
                  <Text style={styles.eventMeta} numberOfLines={1}>
                    {dayWord(o.date, today, tomorrow)} · {occurrenceTimeText(o)}
                    {o.status === 'postponed' ? ' · Postponed' : ''}
                  </Text>
                </View>
                <View style={[styles.kindChip, { backgroundColor: `${tint}18` }]}>
                  <Text style={[styles.kindChipText, { color: tint }]} numberOfLines={1}>
                    {scheduleKindLabel(o.kind)}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </Pressable>

      <View style={styles.metrics}>
        <Metric
          icon="calendar-outline"
          color="#4338ca"
          label="This week"
          value={data ? String(data.weekCount) : '–'}
          meta={data?.weekCount === 1 ? 'event in 7 days' : 'events in 7 days'}
          onPress={() => router.push('/(app)/schedule' as Href)}
        />
        {canCirculars ? (
          <Metric
            icon="archive-outline"
            color="#6d28d9"
            label="Circulars"
            value={data?.circular ? String(data.circular.total) : '–'}
            meta={data?.circular?.latest ? `Latest ${formatDayShort(data.circular.latest.issue_date.slice(0, 10))}` : 'In the archive'}
            onPress={() => router.push('/(app)/circulars' as Href)}
          />
        ) : (
          <Metric
            icon="briefcase-outline"
            color="#0369a1"
            label="iBAS++"
            value="Open"
            meta="Procedures & tools"
            onPress={() => router.push('/(app)/ibas' as Href)}
          />
        )}
        <Metric
          icon="notifications-outline"
          color={unreadCount > 0 ? colors.error : '#0f766e'}
          label="Alerts"
          value={String(unreadCount)}
          meta={unreadCount > 0 ? 'unread' : 'All caught up'}
          onPress={() => router.push('/(app)/notifications' as Href)}
        />
        <Metric
          icon="shield-checkmark-outline"
          color="#e2136e"
          label="My access"
          value={basicDays !== null ? `${basicDays}d` : examDays !== null ? `${examDays}d` : '—'}
          meta={
            basicDays !== null
              ? examDays !== null
                ? `Basic · Exam prep ${examDays}d`
                : 'Basic left'
              : examDays !== null
                ? 'Exam prep left'
                : 'No paid package'
          }
          onPress={() => router.push('/(app)/pricing/payments' as Href)}
        />
      </View>
    </View>
  );
}

function Metric({
  icon,
  color,
  label,
  value,
  meta,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  value: string;
  meta: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.metric, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value} ${meta}`}
    >
      <View style={styles.metricHead}>
        <View style={[styles.metricIcon, { backgroundColor: `${color}1f` }]}>
          <Ionicons name={icon} size={14} color={color} />
        </View>
        <Text style={styles.metricLabel} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricMeta} numberOfLines={1}>
        {meta}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  heading: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  sub: {
    fontSize: 12,
    color: colors.textMuted,
  },
  todayPill: {
    backgroundColor: '#fef3c7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  todayPillText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#92400e',
  },
  upcoming: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.sm + 2,
    gap: spacing.sm,
  },
  upcomingHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  blockTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  muted: {
    fontSize: 13,
    color: colors.textMuted,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  eventBar: {
    width: 4,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  eventTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  eventMeta: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  kindChip: {
    maxWidth: 110,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  kindChipText: {
    fontSize: 10,
    fontWeight: '800',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metric: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 2,
  },
  metricHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricIcon: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  metricMeta: {
    fontSize: 11,
    color: colors.textMuted,
  },
  pressed: {
    opacity: 0.88,
  },
});
