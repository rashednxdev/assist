import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme';

export type ReadFilter = 'all' | 'read' | 'unread';
export type ReadSort = 'unread_first' | 'read_first';

export function formatReadCountLabel(count: number): string {
  if (count <= 0) return '';
  return count === 1 ? 'Read 1 time' : `Read ${count} times`;
}

export function matchesReadFilter(count: number | undefined, filter: ReadFilter): boolean {
  const n = count ?? 0;
  if (filter === 'all') return true;
  if (filter === 'read') return n > 0;
  return n <= 0;
}

export function compareReadCounts(
  aCount: number | undefined,
  bCount: number | undefined,
  sort: ReadSort,
): number {
  const ac = aCount ?? 0;
  const bc = bCount ?? 0;
  const aRead = ac > 0;
  const bRead = bc > 0;
  if (aRead !== bRead) {
    if (sort === 'unread_first') return aRead ? 1 : -1;
    return aRead ? -1 : 1;
  }
  return bc - ac;
}

/** Very small “Read N times” badge. Hidden when the question is unread. */
export function ReadCountBadge({ count }: { count?: number; questionId?: string }) {
  const label = formatReadCountLabel(count ?? 0);
  if (!label) return null;
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const FILTERS: Array<{ id: ReadFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'read', label: 'Read' },
];

const SORTS: Array<{ id: ReadSort; label: string }> = [
  { id: 'unread_first', label: 'Unread first' },
  { id: 'read_first', label: 'Read first' },
];

export function ReadFilterChips({
  value,
  onChange,
}: {
  value: ReadFilter;
  onChange: (value: ReadFilter) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {FILTERS.map((item) => {
        const active = value === item.id;
        return (
          <Pressable
            key={item.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(item.id)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ReadSortChips({
  value,
  onChange,
}: {
  value: ReadSort;
  onChange: (value: ReadSort) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {SORTS.map((item) => {
        const active = value === item.id;
        return (
          <Pressable
            key={item.id}
            style={[styles.chip, active && styles.chipActive]}
            onPress={() => onChange(item.id)}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#ecfdf5',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#047857',
    letterSpacing: 0.1,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.white,
  },
});
