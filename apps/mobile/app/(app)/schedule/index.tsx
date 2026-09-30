import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { addDays, bdTodayStr, type ScheduleOccurrence } from '@ibas/shared-types';
import { Card, Chip, ErrorBox, OccurrenceRow, SCH, SCH_DARK, SCH_SOFT } from '@/components/schedule/ScheduleBits';
import { MonthCalendar } from '@/components/schedule/MonthCalendar';
import { RestRecreationPanel } from '@/components/schedule/RestRecreation';
import { EmptyState } from '@/components/contacts/ContactBits';
import {
  fetchRestRecreation,
  fetchScheduleFeed,
  formatDayLong,
  formatDayShort,
  monthRange,
  occurrenceTimeText,
  useScheduleTypes,
  type RestRecreationData,
} from '@/lib/schedule-api';
import { colors, spacing } from '@/theme';

type Tab = 'upcoming' | 'month' | 'rr';
const UPCOMING_DAYS = 90;
const TABS: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: 'upcoming', label: 'Upcoming', icon: 'list' },
  { id: 'month', label: 'Month', icon: 'calendar' },
  { id: 'rr', label: 'Rest & recreation', icon: 'sunny' },
];

export default function ScheduleScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const { types, typeLabel, typeColor } = useScheduleTypes();
  const today = bdTodayStr();
  const [tab, setTab] = useState<Tab>(() => (TABS.some((t) => t.id === params.tab) ? (params.tab as Tab) : 'upcoming'));
  const [upcoming, setUpcoming] = useState<ScheduleOccurrence[] | null>(null);
  const [monthItems, setMonthItems] = useState<ScheduleOccurrence[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
  const [selectedDay, setSelectedDay] = useState<string>(today);
  const [kindFilter, setKindFilter] = useState('');
  const [rr, setRr] = useState<RestRecreationData | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const firstFocus = useRef(true);

  const loadUpcoming = useCallback(async () => {
    try {
      setUpcoming(await fetchScheduleFeed(today, addDays(today, UPCOMING_DAYS)));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load schedule');
      setUpcoming((cur) => cur ?? []);
    }
  }, [today]);

  const loadMonth = useCallback(async () => {
    const { from, to } = monthRange(ym.y, ym.m);
    setMonthLoading(true);
    try {
      setMonthItems(await fetchScheduleFeed(from, to));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load month');
    } finally {
      setMonthLoading(false);
    }
  }, [ym]);

  const loadRr = useCallback(async () => {
    try {
      setRr(await fetchRestRecreation());
    } catch {
      setRr(null);
    }
  }, []);

  useEffect(() => {
    void loadUpcoming();
    void loadRr();
  }, [loadUpcoming, loadRr]);

  useEffect(() => {
    if (tab === 'month') void loadMonth();
  }, [tab, loadMonth]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      void loadUpcoming();
      if (tab === 'month') void loadMonth();
    }, [loadUpcoming, loadMonth, tab]),
  );

  async function pullRefresh() {
    setRefreshing(true);
    await Promise.all([loadUpcoming(), loadRr(), tab === 'month' ? loadMonth() : Promise.resolve()]);
    setRefreshing(false);
  }

  function open(o: ScheduleOccurrence) {
    if (o.source === 'rr') {
      setTab('rr');
      return;
    }
    router.push(`/(app)/schedule/${o.event_id}?date=${o.date}` as Href);
  }

  function addPersonal(date?: string) {
    router.push((date ? `/(app)/schedule/new?date=${date}` : '/(app)/schedule/new') as Href);
  }

  const filtered = useMemo(() => (upcoming ?? []).filter((o) => !kindFilter || o.kind === kindFilter), [upcoming, kindFilter]);
  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleOccurrence[]>();
    for (const o of filtered) map.set(o.date, [...(map.get(o.date) ?? []), o]);
    return [...map.entries()];
  }, [filtered]);
  const kindsInFeed = useMemo(() => {
    const codes = [...new Set((upcoming ?? []).map((o) => o.kind))];
    const order = (c: string) => {
      const i = types.findIndex((t) => t.code === c);
      return i === -1 ? 999 : i;
    };
    return codes.sort((a, b) => order(a) - order(b));
  }, [upcoming, types]);

  const todayItems = (upcoming ?? []).filter((o) => o.date === today);
  const nextBill = (upcoming ?? []).find((o) => o.kind === 'bill_submission' && o.status !== 'cancelled');
  const dayItems = monthItems.filter((o) => o.date === selectedDay);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void pullRefresh()} />}
    >
      <LinearGradient colors={[SCH, '#4f46e5', SCH_DARK]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <Ionicons name="calendar" size={150} color="rgba(255,255,255,0.08)" style={styles.heroBg} />
        <Text style={styles.kicker}>SCHEDULE</Text>
        <Text style={styles.heroTitle}>Meetings, bill dates, R&R and your own reminders</Text>
        <Text style={styles.heroSub}>All times are Bangladesh time.</Text>
        <Pressable onPress={() => addPersonal(tab === 'month' ? selectedDay : undefined)} style={({ pressed }) => [styles.heroBtn, pressed && styles.pressed]}>
          <Ionicons name="add" size={18} color={SCH} />
          <Text style={styles.heroBtnText}>Add personal</Text>
        </Pressable>
      </LinearGradient>

      {error ? <ErrorBox text={error} /> : null}

      <Card>
        <View style={styles.cardHead}>
          <Ionicons name="sunny" size={16} color="#f59e0b" />
          <Text style={styles.cardTitle}>Today · {formatDayShort(today)}</Text>
        </View>
        {upcoming === null ? (
          <ActivityIndicator color={SCH} />
        ) : todayItems.length === 0 ? (
          <Text style={styles.muted}>Nothing scheduled today.</Text>
        ) : (
          <>
            {todayItems.slice(0, 3).map((o, i) => (
              <Pressable key={`${o.event_id}-${i}`} onPress={() => open(o)} style={styles.todayRow}>
                <View style={[styles.todayDot, { backgroundColor: typeColor(o.kind) }]} />
                <Text style={styles.todayText} numberOfLines={1}>
                  <Text style={styles.muted}>{occurrenceTimeText(o)}</Text> · {o.title}
                </Text>
              </Pressable>
            ))}
            {todayItems.length > 3 ? <Text style={styles.small}>+{todayItems.length - 3} more</Text> : null}
          </>
        )}
      </Card>

      <View style={styles.row2}>
        <Pressable style={({ pressed }) => [styles.mini, pressed && styles.pressed]} onPress={() => nextBill && open(nextBill)} disabled={!nextBill}>
          <View style={styles.cardHead}>
            <Ionicons name="receipt" size={16} color="#047857" />
            <Text style={styles.cardTitle}>Next bill</Text>
          </View>
          {upcoming === null ? (
            <ActivityIndicator color={SCH} />
          ) : nextBill ? (
            <>
              <Text style={styles.miniBig}>{formatDayShort(nextBill.date)}</Text>
              <Text style={styles.small} numberOfLines={2}>
                {nextBill.title}
              </Text>
            </>
          ) : (
            <Text style={styles.small}>None in the next {UPCOMING_DAYS} days.</Text>
          )}
        </Pressable>
        <Pressable style={({ pressed }) => [styles.mini, pressed && styles.pressed]} onPress={() => setTab('rr')}>
          <View style={styles.cardHead}>
            <Ionicons name="umbrella" size={16} color="#0f766e" />
            <Text style={styles.cardTitle}>R&R leave</Text>
          </View>
          {rr?.status.due_date && rr.status.days_left !== undefined ? (
            <>
              <Text style={styles.miniBig}>{rr.status.eligible ? 'Due now' : `${rr.status.days_left} days`}</Text>
              <Text style={styles.small}>
                {rr.status.eligible ? 'Eligible since' : 'Due'} {formatDayShort(rr.status.due_date)}
              </Text>
            </>
          ) : rr ? (
            <Text style={styles.small}>Add your joining date</Text>
          ) : (
            <ActivityIndicator color={SCH} />
          )}
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map((t) => {
          const on = tab === t.id;
          return (
            <Pressable key={t.id} onPress={() => setTab(t.id)} style={[styles.tab, on && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: on }}>
              <Ionicons name={on ? t.icon : (`${t.icon}-outline` as keyof typeof Ionicons.glyphMap)} size={16} color={on ? colors.white : colors.textMuted} />
              <Text style={[styles.tabText, on && styles.tabTextOn]} numberOfLines={1}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === 'upcoming' ? (
        <View style={styles.section}>
          {kindsInFeed.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All" on={!kindFilter} onPress={() => setKindFilter('')} />
              {kindsInFeed.map((k) => (
                <Chip key={k} label={typeLabel(k)} dot={typeColor(k)} on={kindFilter === k} onPress={() => setKindFilter(kindFilter === k ? '' : k)} />
              ))}
            </ScrollView>
          ) : null}
          {upcoming === null ? (
            <ActivityIndicator size="large" color={SCH} style={styles.loader} />
          ) : grouped.length === 0 ? (
            <EmptyState
              icon="calendar-outline"
              title="Nothing coming up"
              text={`No schedules in the next ${UPCOMING_DAYS} days. Add a personal reminder, or check back when the admin posts meetings and deadlines.`}
            />
          ) : (
            grouped.map(([date, list]) => (
              <View key={date} style={styles.group}>
                <Text style={[styles.groupTitle, date === today && styles.groupToday]}>
                  {date === today ? 'Today · ' : date === addDays(today, 1) ? 'Tomorrow · ' : ''}
                  {formatDayLong(date)}
                </Text>
                {list.map((o, i) => (
                  <OccurrenceRow key={`${o.event_id}-${i}`} o={o} onPress={open} />
                ))}
              </View>
            ))
          )}
        </View>
      ) : null}

      {tab === 'month' ? (
        <View style={styles.section}>
          <Card>
            <MonthCalendar
              year={ym.y}
              month={ym.m}
              items={monthItems}
              today={today}
              selected={selectedDay}
              onSelect={setSelectedDay}
              onNavigate={(delta) =>
                setYm((cur) => {
                  const idx = cur.y * 12 + cur.m + delta;
                  return { y: Math.floor(idx / 12), m: idx % 12 };
                })
              }
            />
            {monthLoading ? <ActivityIndicator color={SCH} /> : null}
          </Card>
          <Text style={styles.groupTitle}>{formatDayLong(selectedDay)}</Text>
          {dayItems.length === 0 ? <Text style={styles.muted}>Nothing scheduled.</Text> : dayItems.map((o, i) => <OccurrenceRow key={`${o.event_id}-${i}`} o={o} onPress={open} />)}
          <Pressable style={({ pressed }) => [styles.addDay, pressed && styles.pressed]} onPress={() => addPersonal(selectedDay)}>
            <Ionicons name="add" size={18} color={SCH} />
            <Text style={styles.addDayText}>Add on this day</Text>
          </Pressable>
        </View>
      ) : null}

      {tab === 'rr' ? (
        <View style={styles.section}>
          <RestRecreationPanel
            data={rr}
            onSaved={(d) => {
              setRr(d);
              void loadUpcoming();
            }}
          />
          {rr ? <Text style={styles.small}>R&R due dates also appear in your Upcoming list and reminders.</Text> : null}
        </View>
      ) : null}
    </ScrollView>
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
  pressed: {
    opacity: 0.85,
  },
  hero: {
    borderRadius: 22,
    padding: spacing.lg,
    gap: 6,
    overflow: 'hidden',
  },
  heroBg: {
    position: 'absolute',
    right: -24,
    top: -24,
  },
  kicker: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: 'rgba(255,255,255,0.75)',
  },
  heroTitle: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 25,
    color: colors.white,
  },
  heroSub: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: spacing.sm,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: colors.white,
  },
  heroBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: SCH,
  },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  muted: {
    fontSize: 14,
    color: colors.textMuted,
  },
  small: {
    fontSize: 12,
    color: colors.textMuted,
  },
  todayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 2,
  },
  todayDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  todayText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  row2: {
    flexDirection: 'row',
    gap: spacing.sm + 4,
  },
  mini: {
    flex: 1,
    gap: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  miniBig: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 8,
    borderRadius: 10,
  },
  tabOn: {
    backgroundColor: SCH,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
  },
  tabTextOn: {
    color: colors.white,
  },
  section: {
    gap: spacing.sm + 4,
  },
  chips: {
    gap: 6,
    paddingRight: spacing.md,
  },
  loader: {
    marginTop: spacing.lg,
  },
  group: {
    gap: spacing.sm,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  groupToday: {
    color: SCH,
  },
  addDay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#c7d2fe',
    backgroundColor: SCH_SOFT,
    paddingVertical: 11,
  },
  addDayText: {
    fontSize: 14,
    fontWeight: '700',
    color: SCH,
  },
});
