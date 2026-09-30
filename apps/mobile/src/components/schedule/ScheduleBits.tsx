import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ScheduleOccurrence } from '@ibas/shared-types';
import { occurrenceTimeText, slotText, useScheduleTypes } from '@/lib/schedule-api';
import { colors, spacing } from '@/theme';

export const SCH = '#4338ca';
export const SCH_DARK = '#312e81';
export const SCH_SOFT = '#eef2ff';

export function Chip({ label, on, onPress, dot, disabled }: { label: string; on: boolean; onPress: () => void; dot?: string; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.chip, on && styles.chipOn, disabled && !on && styles.chipDisabled, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityState={{ selected: on, disabled }}
    >
      {dot ? <View style={[styles.chipDot, { backgroundColor: dot }]} /> : null}
      <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

export function Tag({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'danger' | 'warning' | 'info' }) {
  return (
    <View style={[styles.tag, styles[`tag_${tone}`]]}>
      <Text style={[styles.tagText, styles[`tagText_${tone}`]]}>{label}</Text>
    </View>
  );
}

export function ErrorBox({ text }: { text: string }) {
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle" size={18} color={colors.error} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionLabel({ icon, text }: { icon?: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.sectionRow}>
      {icon ? <Ionicons name={icon} size={14} color={colors.textMuted} /> : null}
      <Text style={styles.sectionText}>{text}</Text>
    </View>
  );
}

export function OccurrenceRow({ o, onPress }: { o: ScheduleOccurrence; onPress: (o: ScheduleOccurrence) => void }) {
  const { typeLabel, typeColor } = useScheduleTypes();
  const cancelled = o.status === 'cancelled';
  return (
    <Pressable onPress={() => onPress(o)} style={({ pressed }) => [styles.row, cancelled && styles.rowCancelled, pressed && styles.pressed]}>
      <View style={[styles.rowBar, { backgroundColor: typeColor(o.kind) }, cancelled && styles.faded]} />
      <View style={styles.rowBody}>
        <View style={styles.rowTitleLine}>
          <Text style={[styles.rowTitle, cancelled && styles.struck]} numberOfLines={2}>
            {o.title}
          </Text>
          {cancelled ? <Tag label="Cancelled" tone="danger" /> : null}
          {o.status === 'postponed' ? <Tag label="Postponed" tone="warning" /> : null}
        </View>
        {o.status === 'postponed' && o.original_date ? <Text style={styles.rowWas}>Was {slotText(o.original_date, o.original_time)}</Text> : null}
        {o.note && o.status !== 'scheduled' ? (
          <Text style={styles.rowNote} numberOfLines={2}>
            Note: {o.note}
          </Text>
        ) : null}
        <View style={styles.rowMeta}>
          <Text style={styles.rowMetaText}>{occurrenceTimeText(o)}</Text>
          <Text style={styles.rowMetaText}>· {typeLabel(o.kind)}</Text>
          <Text style={styles.rowMetaText}>· {o.source === 'rr' ? 'R&R' : o.scope === 'universal' ? 'Official' : 'Personal'}</Text>
          {o.location ? (
            <Text style={[styles.rowMetaText, styles.shrink]} numberOfLines={1}>
              · {o.location}
            </Text>
          ) : null}
          {o.recurring ? <Ionicons name="repeat" size={12} color={colors.textMuted} /> : null}
          {o.attachments_count > 0 ? (
            <View style={styles.metaIcon}>
              <Ionicons name="attach" size={12} color={colors.textMuted} />
              <Text style={styles.rowMetaText}>{o.attachments_count}</Text>
            </View>
          ) : null}
          {o.links_count > 0 ? (
            <View style={styles.metaIcon}>
              <Ionicons name="link" size={12} color={colors.textMuted} />
              <Text style={styles.rowMetaText}>{o.links_count}</Text>
            </View>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: {
    backgroundColor: SCH,
    borderColor: SCH,
  },
  chipDisabled: {
    opacity: 0.45,
  },
  chipDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  chipTextOn: {
    color: colors.white,
  },
  tag: {
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tag_neutral: {
    backgroundColor: '#f1f5f9',
  },
  tag_danger: {
    backgroundColor: '#fee2e2',
  },
  tag_warning: {
    backgroundColor: '#fef3c7',
  },
  tag_info: {
    backgroundColor: SCH_SOFT,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
  },
  tagText_neutral: {
    color: colors.textMuted,
  },
  tagText_danger: {
    color: '#b91c1c',
  },
  tagText_warning: {
    color: '#92400e',
  },
  tagText_info: {
    color: SCH,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    padding: spacing.sm + 4,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991b1b',
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm + 4,
  },
  rowCancelled: {
    backgroundColor: '#f8fafc',
  },
  rowBar: {
    width: 4,
    alignSelf: 'stretch',
    minHeight: 36,
    borderRadius: 2,
  },
  faded: {
    opacity: 0.4,
  },
  rowBody: {
    flex: 1,
    gap: 3,
  },
  rowTitleLine: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  rowTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  struck: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  rowWas: {
    fontSize: 12,
    color: '#92400e',
  },
  rowNote: {
    fontSize: 12,
    color: colors.textMuted,
  },
  rowMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  rowMetaText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  shrink: {
    flexShrink: 1,
  },
  metaIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
});
