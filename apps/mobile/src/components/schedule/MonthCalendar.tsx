import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BD_WEEKEND_DAYS, WEEKDAY_LABELS, type ScheduleOccurrence } from '@ibas/shared-types';
import { monthRange, monthTitle, useScheduleTypes } from '@/lib/schedule-api';
import { SCH, SCH_SOFT } from '@/components/schedule/ScheduleBits';
import { colors, spacing } from '@/theme';

const WEEKEND = BD_WEEKEND_DAYS as readonly number[];

export function MonthCalendar({
  year,
  month,
  items,
  today,
  selected,
  onSelect,
  onNavigate,
}: {
  year: number;
  month: number;
  items: ScheduleOccurrence[];
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
  onNavigate: (delta: number) => void;
}) {
  const { typeColor } = useScheduleTypes();
  const { days } = monthRange(year, month);
  const byDay = useMemo(() => {
    const map = new Map<string, ScheduleOccurrence[]>();
    for (const o of items) map.set(o.date, [...(map.get(o.date) ?? []), o]);
    return map;
  }, [items]);
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Pressable onPress={() => onNavigate(-1)} hitSlop={10} style={styles.navBtn} accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={20} color={SCH} />
        </Pressable>
        <Text style={styles.title}>{monthTitle(year, month)}</Text>
        <Pressable onPress={() => onNavigate(1)} hitSlop={10} style={styles.navBtn} accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={20} color={SCH} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        {WEEKDAY_LABELS.map((w, i) => (
          <Text key={w} style={[styles.weekday, WEEKEND.includes(i) && styles.weekendText]}>
            {w.slice(0, 2)}
          </Text>
        ))}
        {days.map((d, i) => {
          const list = byDay.get(d) ?? [];
          const inMonth = d.startsWith(monthPrefix);
          const isSel = d === selected;
          const isToday = d === today;
          const dots = [...new Set(list.filter((o) => o.status !== 'cancelled').map((o) => o.kind))].slice(0, 3);
          return (
            <Pressable
              key={d}
              onPress={() => onSelect(d)}
              style={[styles.cell, WEEKEND.includes(i % 7) && styles.weekendCell, isSel && styles.cellSel]}
              accessibilityLabel={`${d}${list.length ? `, ${list.length} items` : ''}`}
            >
              <View style={[styles.dayNum, isToday && styles.today]}>
                <Text style={[styles.dayText, !inMonth && styles.outText, isToday && styles.todayText]}>{Number(d.slice(8, 10))}</Text>
              </View>
              <View style={styles.dots}>
                {dots.map((k) => (
                  <View key={k} style={[styles.dot, { backgroundColor: typeColor(k) }]} />
                ))}
                {list.length > 0 && dots.length === 0 ? <View style={[styles.dot, styles.dotCancelled]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: SCH_SOFT,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  weekday: {
    width: `${100 / 7}%`,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: colors.textMuted,
    paddingVertical: 4,
  },
  weekendText: {
    color: '#c2410c',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    paddingVertical: 4,
    minHeight: 46,
    borderRadius: 10,
  },
  weekendCell: {
    backgroundColor: '#fff7ed',
  },
  cellSel: {
    backgroundColor: SCH_SOFT,
    borderWidth: 1,
    borderColor: SCH,
  },
  dayNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: {
    backgroundColor: SCH,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  outText: {
    color: '#cbd5e1',
  },
  todayText: {
    color: colors.white,
    fontWeight: '800',
  },
  dots: {
    flexDirection: 'row',
    gap: 2,
    height: 6,
    marginTop: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotCancelled: {
    backgroundColor: '#cbd5e1',
  },
});
