import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { CircularRecord } from '@ibas/shared-types';
import { circularIssuedBy, collectionName, docTypeLabel } from '@/lib/circulars-api';
import { formatDdMmYyyy } from '@/lib/date-format';
import { colors, spacing } from '@/theme';

export const CIR = '#6d28d9';
export const CIR_DARK = '#4c1d95';
export const CIR_SOFT = '#f5f3ff';

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'violet' | 'danger' | 'warning' | 'success'; icon?: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={[styles.pill, styles[`pill_${tone}`]]}>
      {icon ? <Ionicons name={icon} size={11} color={PILL_TEXT[tone]} /> : null}
      <Text style={[styles.pillText, { color: PILL_TEXT[tone] }]}>{label}</Text>
    </View>
  );
}

const PILL_TEXT = {
  neutral: colors.textMuted,
  violet: CIR,
  danger: '#b91c1c',
  warning: '#92400e',
  success: '#047857',
} as const;

export function CircularCard({
  c,
  onPress,
  onTag,
  onArea,
  areaName,
}: {
  c: CircularRecord;
  onPress: () => void;
  onTag?: (tag: string) => void;
  onArea?: (code: string) => void;
  areaName: (code: string) => string;
}) {
  const superseded = c.superseded_by.length > 0;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.topLine}>
        <Text style={styles.no} numberOfLines={1}>
          {c.circular_no}
        </Text>
        <Text style={styles.date}>{formatDdMmYyyy(c.issue_date)}</Text>
      </View>
      <View style={styles.pills}>
        <Pill label={docTypeLabel(c.doc_type)} tone="violet" />
        {c.checklist_count > 0 ? <Pill label="Checklist" icon="checkbox-outline" tone="success" /> : null}
        {!c.is_published ? <Pill label="Draft" tone="warning" /> : null}
        {superseded ? <Pill label="Superseded" tone="danger" /> : null}
      </View>
      <Text style={[styles.title, superseded && styles.titleOld]}>{c.title}</Text>
      {c.title_bn ? <Text style={styles.titleBn}>{c.title_bn}</Text> : null}
      <Text style={styles.meta} numberOfLines={2}>
        {circularIssuedBy(c)}
        {c.order_by ? ` · Signed by ${c.order_by}${c.order_by_designation ? `, ${c.order_by_designation}` : ''}` : ''}
      </Text>
      {c.summary ? (
        <Text style={styles.summary} numberOfLines={2}>
          {c.summary}
        </Text>
      ) : null}
      {c.collections.length > 0 || c.areas.length > 0 || c.tags.length > 0 ? (
        <View style={styles.pills}>
          {c.collections.map((code) => (
            <Pill key={code} label={collectionName(code)} />
          ))}
          {c.areas.map((code) => (
            <Pressable key={code} onPress={() => onArea?.(code)} hitSlop={4}>
              <Pill label={areaName(code)} icon="briefcase-outline" />
            </Pressable>
          ))}
          {c.tags.map((t) => (
            <Pressable key={t} onPress={() => onTag?.(t)} hitSlop={4}>
              <Text style={styles.tag}>#{t}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pill_neutral: {
    backgroundColor: '#f1f5f9',
  },
  pill_violet: {
    backgroundColor: CIR_SOFT,
  },
  pill_danger: {
    backgroundColor: '#fee2e2',
  },
  pill_warning: {
    backgroundColor: '#fef3c7',
  },
  pill_success: {
    backgroundColor: '#d1fae5',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    gap: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  no: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: colors.text,
  },
  date: {
    fontSize: 12,
    color: colors.textMuted,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 21,
    color: colors.text,
  },
  titleOld: {
    color: colors.textMuted,
  },
  titleBn: {
    fontSize: 14,
    color: colors.textMuted,
  },
  meta: {
    fontSize: 12,
    color: colors.textMuted,
  },
  summary: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.text,
  },
  tag: {
    fontSize: 12,
    fontWeight: '600',
    color: CIR,
    backgroundColor: CIR_SOFT,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: 'hidden',
  },
});
