import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { formatDeductionAmount, type DeductionEntryDetail } from '@ibas/shared-types';
import { IbasCard, IbasErrorScreen, IbasLoading, ibasStyles, SectionHead } from '@/components/ibas/IbasBits';
import { DED, DED_DARK, DED_PROCESS_AREA, fetchDeduction } from '@/lib/deductions-api';
import { areaHref, openFileLink } from '@/lib/ibas-api';
import { formatDdMmYyyy } from '@/lib/date-format';
import { colors, spacing } from '@/theme';

export default function DeductionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [d, setD] = useState<DeductionEntryDetail | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setD(await fetchDeduction(id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this entry');
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!d) return error ? <IbasErrorScreen message={error} /> : <IbasLoading color={DED} />;

  return (
    <ScrollView style={ibasStyles.root} contentContainerStyle={ibasStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      <IbasCard accent={DED}>
        <Text style={ibasStyles.kicker}>ECONOMIC CODE</Text>
        <View style={styles.headRow}>
          <Text style={styles.code} selectable>
            {d.economic_code.code ?? '—'}
          </Text>
          <View style={styles.flex}>
            {d.economic_code.name_en ? (
              <Text style={styles.ecoName} selectable>
                {d.economic_code.name_en}
              </Text>
            ) : null}
            {d.economic_code.name_bn ? <Text style={ibasStyles.small}>{d.economic_code.name_bn}</Text> : null}
          </View>
        </View>
        <View style={styles.billRow}>
          <Ionicons name="document-text-outline" size={15} color={DED} />
          <Text style={styles.bill}>
            {d.bill_type.name_en}
            {d.bill_type.name_bn ? <Text style={ibasStyles.small}>  {d.bill_type.name_bn}</Text> : null}
          </Text>
        </View>
        {d.title ? <Text style={ibasStyles.title}>{d.title}</Text> : null}
      </IbasCard>

      <IbasCard>
        <SectionHead icon="calculator-outline" title="Deductions" color={DED} />
        {d.deductions.map((l, i) => (
          <View key={l.deduction_type.id} style={[styles.line, i > 0 && styles.lineBorder]}>
            <View style={styles.flex}>
              <Text style={styles.lineType}>{l.deduction_type.name_en}</Text>
              {l.deduction_type.code ? <Text style={styles.lineCode}>{l.deduction_type.code}</Text> : null}
              {l.note ? <Text style={ibasStyles.small}>{l.note}</Text> : null}
            </View>
            <Text style={[styles.amount, l.mode === 'text' && styles.amountText]} selectable>
              {formatDeductionAmount(l)}
            </Text>
          </View>
        ))}
      </IbasCard>

      {d.highlights.length > 0 ? (
        <View style={styles.highlights}>
          <Text style={styles.highlightsTitle}>Highlights</Text>
          {d.highlights.map((h, i) => (
            <View key={i} style={styles.highlightRow}>
              <Ionicons name="checkmark-circle" size={18} color="#059669" />
              <Text style={styles.highlightText}>{h}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {d.details ? (
        <IbasCard>
          <SectionHead icon="reader-outline" title="Details" color={DED} />
          <Text style={ibasStyles.body} selectable>
            {d.details}
          </Text>
        </IbasCard>
      ) : null}

      {d.source ? (
        <IbasCard>
          <SectionHead icon="library-outline" title="Source" color={DED} />
          <Text style={ibasStyles.body} selectable>
            {d.source}
          </Text>
        </IbasCard>
      ) : null}

      {d.processes.length > 0 ? (
        <IbasCard>
          <SectionHead icon="git-branch-outline" title="Related process" color={DED} />
          {d.processes.map((p) => (
            <Pressable key={p.id} onPress={() => router.push(areaHref(DED_PROCESS_AREA, 'process', p.id))} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
              <Ionicons name="git-network-outline" size={18} color={DED} />
              <View style={styles.flex}>
                <Text style={styles.linkText}>{p.name_en}</Text>
                {p.name_bn ? <Text style={ibasStyles.small}>{p.name_bn}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </IbasCard>
      ) : null}

      {d.circulars.length > 0 ? (
        <IbasCard>
          <SectionHead icon="archive-outline" title="Circulars" color={DED} />
          {d.circulars.map((c) => (
            <Pressable key={c.id} onPress={() => router.push(`/(app)/deductions/circular/${c.id}` as Href)} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]}>
              <View style={styles.flex}>
                <Text style={styles.circNo}>{c.circular_no}</Text>
                <Text style={styles.linkText}>{c.title}</Text>
                {c.issue_date ? <Text style={ibasStyles.small}>{formatDdMmYyyy(c.issue_date)}</Text> : null}
              </View>
              {c.attachment_url ? (
                <Pressable onPress={() => openFileLink(c.attachment_url!)} hitSlop={10} accessibilityRole="button" accessibilityLabel="Open document">
                  <Ionicons name="document-attach-outline" size={20} color={DED} />
                </Pressable>
              ) : null}
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </IbasCard>
      ) : null}

      <Text style={ibasStyles.disclaimer}>Rates change with each Finance Act. Always verify against the latest official rules and circulars before deducting.</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  headRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
  },
  code: {
    borderRadius: 10,
    backgroundColor: '#fef3c7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    overflow: 'hidden',
    fontFamily: 'monospace',
    fontSize: 16,
    fontWeight: '800',
    color: DED_DARK,
  },
  ecoName: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
    color: colors.text,
  },
  billRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  bill: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: DED,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
  },
  lineBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  lineType: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  lineCode: {
    fontSize: 11,
    fontWeight: '800',
    color: DED,
  },
  amount: {
    fontSize: 20,
    fontWeight: '800',
    color: DED_DARK,
  },
  amountText: {
    maxWidth: '50%',
    fontSize: 14,
    textAlign: 'right',
  },
  highlights: {
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    backgroundColor: '#f0fdf4',
    padding: spacing.md,
  },
  highlightsTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#065f46',
  },
  highlightRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  highlightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.sm + 4,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  circNo: {
    fontFamily: 'monospace',
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
});
