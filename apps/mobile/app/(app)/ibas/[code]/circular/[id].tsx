import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CircularChecklistItem, CircularRecord } from '@ibas/shared-types';
import { HtmlContent } from '@/components/books/HtmlContent';
import { Badge, IbasCard, IbasError, IbasErrorScreen, IbasLoading, ibasStyles, SectionHead } from '@/components/ibas/IbasBits';
import { collectionName, docTypeLabel, issuerLabel, loadChecklistTicks, saveChecklistTicks } from '@/lib/circulars-api';
import { formatDdMmYyyy } from '@/lib/date-format';
import { areaHref, fetchAreaCircular, openFileLink } from '@/lib/ibas-api';
import { useIbasAreas } from '@/lib/ibas-areas';
import { colors, spacing } from '@/theme';

function Meta({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.meta}>
      <Text style={ibasStyles.label}>{label}</Text>
      <Text style={[styles.metaValue, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

function Checklist({ circularId, items, color }: { circularId: string; items: CircularChecklistItem[]; color: string }) {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    void loadChecklistTicks(circularId).then(setDone);
  }, [circularId]);

  function toggle(id: string) {
    setDone((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      void saveChecklistTicks(circularId, next);
      return next;
    });
  }

  function reset() {
    setDone({});
    void saveChecklistTicks(circularId, {});
  }

  const doneCount = items.filter((i) => done[i.id]).length;
  const requiredLeft = items.filter((i) => i.required && !done[i.id]).length;

  return (
    <IbasCard>
      <SectionHead
        icon="checkbox-outline"
        title={`Checklist  ${doneCount}/${items.length}`}
        color={color}
        right={
          doneCount > 0 ? (
            <Pressable onPress={reset} hitSlop={8} style={styles.reset}>
              <Ionicons name="refresh" size={14} color={colors.textMuted} />
              <Text style={styles.resetText}>Reset</Text>
            </Pressable>
          ) : null
        }
      />
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }]} />
      </View>
      {items.map((it, idx) => {
        const on = !!done[it.id];
        return (
          <Pressable key={it.id} onPress={() => toggle(it.id)} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? '#059669' : colors.textMuted} />
            <Text style={[styles.checkText, on && styles.checkDone]}>
              {idx + 1}. {it.text}
              {!it.required ? <Text style={ibasStyles.small}> (optional)</Text> : null}
            </Text>
          </Pressable>
        );
      })}
      <Text style={ibasStyles.small}>
        {requiredLeft === 0 ? 'All required items are ticked.' : `${requiredLeft} required item(s) left.`} Ticks are saved on this phone only.
      </Text>
    </IbasCard>
  );
}

export default function AreaCircularScreen() {
  const router = useRouter();
  const { code, id } = useLocalSearchParams<{ code: string; id: string }>();
  const { areaColor, areaName } = useIbasAreas();
  const [c, setC] = useState<CircularRecord | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!code || !id) return;
    try {
      setC(await fetchAreaCircular(code, id));
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load circular');
    }
  }, [code, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const accent = code ? areaColor(code) : colors.primary;
  if (!c || !code) return error ? <IbasErrorScreen message={error} /> : <IbasLoading color={accent} />;

  const goCircular = (cid: string) => router.push(areaHref(code, 'circular', cid));
  const note = c.note?.trim();
  const orderBy = [c.order_by, c.order_by_designation].filter(Boolean).join(', ');

  return (
    <>
      <Stack.Screen options={{ title: 'Circular' }} />
      <ScrollView style={ibasStyles.root} contentContainerStyle={ibasStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        {error ? <IbasError message={error} /> : null}

        <IbasCard accent={accent}>
          <View style={ibasStyles.row}>
            <Badge label={docTypeLabel(c.doc_type)} color={accent} filled />
            {!c.is_published ? <Badge label="Draft" color={colors.warning} /> : null}
            {c.superseded_by.length > 0 ? <Badge label="Superseded" color={colors.error} /> : null}
          </View>
          <Text style={[styles.no, styles.mono]} selectable>
            {c.circular_no}
          </Text>
          <Text style={ibasStyles.title} selectable>
            {c.title}
          </Text>
          {c.title_bn ? (
            <Text style={ibasStyles.titleBn} selectable>
              {c.title_bn}
            </Text>
          ) : null}
          <Text style={ibasStyles.small}>
            {formatDdMmYyyy(c.issue_date)}
            {c.effective_date ? ` · effective ${formatDdMmYyyy(c.effective_date)}` : ''}
          </Text>
          {c.attachment_url || c.source_url ? (
            <View style={styles.btnRow}>
              {c.attachment_url ? (
                <Pressable style={({ pressed }) => [styles.btn, { backgroundColor: accent }, pressed && styles.pressed]} onPress={() => openFileLink(c.attachment_url!)}>
                  <Ionicons name="document-attach" size={16} color={colors.white} />
                  <Text style={styles.btnText}>Open document</Text>
                </Pressable>
              ) : null}
              {c.source_url ? (
                <Pressable style={({ pressed }) => [styles.btn, styles.btnOutline, { borderColor: accent }, pressed && styles.pressed]} onPress={() => openFileLink(c.source_url!)}>
                  <Ionicons name="open-outline" size={16} color={accent} />
                  <Text style={[styles.btnText, { color: accent }]}>Official source</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </IbasCard>

        {c.superseded_by.length > 0 ? (
          <View style={styles.warn}>
            <View style={styles.warnHead}>
              <Ionicons name="warning" size={16} color="#92400e" />
              <Text style={styles.warnTitle}>This circular has been superseded by:</Text>
            </View>
            {c.superseded_by.map((s) => (
              <Pressable key={s.id} onPress={() => goCircular(s.id)} style={styles.warnLink}>
                <Text style={styles.warnText}>
                  <Text style={styles.warnNo}>{s.circular_no}</Text> — {s.title}
                </Text>
                <Ionicons name="chevron-forward" size={14} color="#92400e" />
              </Pressable>
            ))}
          </View>
        ) : null}

        {c.summary ? (
          <IbasCard>
            <SectionHead icon="reader-outline" title="Summary" color={accent} />
            <Text style={ibasStyles.body} selectable>
              {c.summary}
            </Text>
          </IbasCard>
        ) : null}

        {c.checklist && c.checklist.length > 0 ? <Checklist circularId={c.id} items={c.checklist} color={accent} /> : null}

        {note ? (
          <View style={styles.noteCard}>
            <SectionHead icon="document-text-outline" title="Note" color="#92400e" />
            {note.startsWith('<') ? <HtmlContent html={note} /> : <Text style={ibasStyles.body}>{note}</Text>}
          </View>
        ) : null}

        <IbasCard>
          <SectionHead icon="newspaper-outline" title="Full text" color={accent} />
          {c.full_text ? (
            <HtmlContent html={c.full_text} />
          ) : (
            <Text style={ibasStyles.small}>Full text has not been added yet.{c.attachment_url ? ' Use “Open document” to read the original.' : ''}</Text>
          )}
        </IbasCard>

        <IbasCard>
          <SectionHead icon="information-circle-outline" title="Details" color={accent} />
          <Meta label="Order / memo no." value={c.circular_no} mono />
          <Meta label="Document type" value={docTypeLabel(c.doc_type)} />
          <Meta label="Order date" value={formatDdMmYyyy(c.issue_date)} />
          <Meta label="Effective from" value={c.effective_date ? formatDdMmYyyy(c.effective_date) : undefined} />
          <Meta label="Issued by" value={issuerLabel(c.issuer)} />
          <Meta label="Ministry / division" value={c.ministry} />
          <Meta label="Department / office" value={c.department} />
          <Meta label="Wing / branch" value={c.issuer_detail} />
          <Meta label="Order by" value={orderBy || undefined} />
          {c.collections.length > 0 ? <Meta label="Policy collections" value={c.collections.map(collectionName).join(', ')} /> : null}
          {c.areas.length > 0 ? <Meta label="iBAS++ areas" value={c.areas.map(areaName).join(', ')} /> : null}
          {c.tags.length > 0 ? <Meta label="Tags" value={c.tags.map((t) => `#${t}`).join('  ')} /> : null}
        </IbasCard>

        {c.toolkit && c.toolkit.length > 0 ? (
          <IbasCard>
            <SectionHead icon="clipboard-outline" title="Related checklists & templates" color={accent} />
            {c.toolkit.map((k) => (
              <Pressable key={k.id} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]} onPress={() => router.push(areaHref(code, 'kit', k.id))}>
                <Text style={styles.linkText}>
                  {k.title}
                  {!k.is_published ? <Text style={ibasStyles.small}> (draft)</Text> : null}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </IbasCard>
        ) : null}

        {c.supersedes.length > 0 ? (
          <IbasCard>
            <SectionHead icon="time-outline" title="Replaces" color={accent} />
            {c.supersedes.map((s) => (
              <Pressable key={s.id} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]} onPress={() => goCircular(s.id)}>
                <View style={styles.flex}>
                  <Text style={[ibasStyles.small, styles.mono]}>{s.circular_no}</Text>
                  <Text style={styles.linkText}>{s.title}</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
              </Pressable>
            ))}
          </IbasCard>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  no: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  mono: {
    fontFamily: 'monospace',
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
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnOutline: {
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  warn: {
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    padding: spacing.md,
  },
  warnHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warnTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#92400e',
  },
  warnLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  warnText: {
    flex: 1,
    fontSize: 13,
    color: '#92400e',
  },
  warnNo: {
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  noteCard: {
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    padding: spacing.md,
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: '#f1f5f9',
  },
  fill: {
    height: '100%',
    backgroundColor: '#10b981',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    paddingVertical: 4,
  },
  checkText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
  },
  checkDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  reset: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  resetText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textMuted,
  },
  meta: {
    gap: 1,
  },
  metaValue: {
    fontSize: 14,
    fontWeight: '600',
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
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
});
