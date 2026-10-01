import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CircularRecord } from '@ibas/shared-types';
import { HtmlContent } from '@/components/books/HtmlContent';
import { Badge, IbasCard, IbasErrorScreen, IbasLoading, ibasStyles, SectionHead } from '@/components/ibas/IbasBits';
import { docTypeLabel, issuerLabel } from '@/lib/circulars-api';
import { formatDdMmYyyy } from '@/lib/date-format';
import { DED, fetchDeductionCircular } from '@/lib/deductions-api';
import { openFileLink } from '@/lib/ibas-api';
import { colors, spacing } from '@/theme';

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.meta}>
      <Text style={ibasStyles.label}>{label}</Text>
      <Text style={styles.metaValue} selectable>
        {value}
      </Text>
    </View>
  );
}

export default function DeductionCircularScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [c, setC] = useState<CircularRecord | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setC(await fetchDeductionCircular(id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load circular');
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

  if (!c) return error ? <IbasErrorScreen message={error} /> : <IbasLoading color={DED} />;

  const note = c.note?.trim();

  return (
    <ScrollView style={ibasStyles.root} contentContainerStyle={ibasStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      <IbasCard accent={DED}>
        <View style={ibasStyles.row}>
          <Badge label={docTypeLabel(c.doc_type)} color={DED} filled />
          {c.superseded_by.length > 0 ? <Badge label="Superseded" color={colors.error} /> : null}
        </View>
        <Text style={styles.no} selectable>
          {c.circular_no}
        </Text>
        <Text style={ibasStyles.title} selectable>
          {c.title}
        </Text>
        {c.title_bn ? <Text style={ibasStyles.titleBn}>{c.title_bn}</Text> : null}
        <Text style={ibasStyles.small}>
          {formatDdMmYyyy(c.issue_date)}
          {c.effective_date ? ` · effective ${formatDdMmYyyy(c.effective_date)}` : ''}
        </Text>
        {c.attachment_url || c.source_url ? (
          <View style={styles.btnRow}>
            {c.attachment_url ? (
              <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={() => openFileLink(c.attachment_url!)}>
                <Ionicons name="document-attach" size={16} color={colors.white} />
                <Text style={styles.btnText}>Open document</Text>
              </Pressable>
            ) : null}
            {c.source_url ? (
              <Pressable style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && styles.pressed]} onPress={() => openFileLink(c.source_url!)}>
                <Ionicons name="open-outline" size={16} color={DED} />
                <Text style={[styles.btnText, { color: DED }]}>Official source</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </IbasCard>

      {c.superseded_by.length > 0 ? (
        <View style={styles.warn}>
          <Ionicons name="warning" size={16} color="#92400e" />
          <Text style={styles.warnText}>Superseded by {c.superseded_by.map((s) => s.circular_no).join(', ')}.</Text>
        </View>
      ) : null}

      {c.summary ? (
        <IbasCard>
          <SectionHead icon="reader-outline" title="Summary" color={DED} />
          <Text style={ibasStyles.body} selectable>
            {c.summary}
          </Text>
        </IbasCard>
      ) : null}

      {note ? (
        <IbasCard>
          <SectionHead icon="document-text-outline" title="Note" color={DED} />
          {note.startsWith('<') ? <HtmlContent html={note} /> : <Text style={ibasStyles.body}>{note}</Text>}
        </IbasCard>
      ) : null}

      <IbasCard>
        <SectionHead icon="newspaper-outline" title="Full text" color={DED} />
        {c.full_text ? (
          <HtmlContent html={c.full_text} />
        ) : (
          <Text style={ibasStyles.small}>Full text has not been added yet.{c.attachment_url ? ' Use “Open document” to read the original.' : ''}</Text>
        )}
      </IbasCard>

      <IbasCard>
        <SectionHead icon="information-circle-outline" title="Details" color={DED} />
        <Meta label="Order / memo no." value={c.circular_no} />
        <Meta label="Document type" value={docTypeLabel(c.doc_type)} />
        <Meta label="Order date" value={formatDdMmYyyy(c.issue_date)} />
        <Meta label="Effective from" value={c.effective_date ? formatDdMmYyyy(c.effective_date) : undefined} />
        <Meta label="Issued by" value={issuerLabel(c.issuer)} />
        <Meta label="Ministry / division" value={c.ministry} />
        <Meta label="Department / office" value={c.department} />
      </IbasCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.8,
  },
  no: {
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  btnRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    backgroundColor: DED,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnOutline: {
    borderWidth: 1,
    borderColor: DED,
    backgroundColor: colors.surface,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  warn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    padding: spacing.md,
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
  },
  meta: {
    gap: 1,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
