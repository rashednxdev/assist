import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { CircularChecklistItem, CircularRecord } from '@ibas/shared-types';
import { HtmlContent } from '@/components/books/HtmlContent';
import { CIR, CIR_SOFT, Pill } from '@/components/circulars/CircularBits';
import {
  collectionName,
  docTypeLabel,
  fetchCircular,
  issuerLabel,
  loadChecklistTicks,
  saveChecklistTicks,
} from '@/lib/circulars-api';
import { formatDdMmYyyy } from '@/lib/date-format';
import { useIbasAreas } from '@/lib/ibas-areas';
import { openHref } from '@/lib/web-href';
import { colors, spacing } from '@/theme';

function Section({ icon, title, right, children, tone }: { icon: keyof typeof Ionicons.glyphMap; title: string; right?: ReactNode; children: ReactNode; tone?: 'note' }) {
  return (
    <View style={[styles.card, tone === 'note' && styles.noteCard]}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={16} color={tone === 'note' ? '#92400e' : CIR} />
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.flex} />
        {right}
      </View>
      {children}
    </View>
  );
}

function Meta({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  if (!value) return null;
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={[styles.metaValue, mono && styles.mono]} selectable>
        {value}
      </Text>
    </View>
  );
}

function Checklist({ circularId, items }: { circularId: string; items: CircularChecklistItem[] }) {
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
    <Section
      icon="checkbox-outline"
      title={`Checklist  ${doneCount}/${items.length}`}
      right={
        doneCount > 0 ? (
          <Pressable onPress={reset} hitSlop={8} style={styles.reset}>
            <Ionicons name="refresh" size={14} color={colors.textMuted} />
            <Text style={styles.resetText}>Reset</Text>
          </Pressable>
        ) : null
      }
    >
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }]} />
      </View>
      {items.map((it, idx) => {
        const on = !!done[it.id];
        return (
          <Pressable key={it.id} onPress={() => toggle(it.id)} style={({ pressed }) => [styles.checkRow, pressed && styles.pressed]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
            <Ionicons name={on ? 'checkbox' : 'square-outline'} size={22} color={on ? '#059669' : colors.textMuted} />
            <Text style={[styles.checkText, on && styles.checkDone]}>
              {idx + 1}. {it.text}
              {!it.required ? <Text style={styles.optional}> (optional)</Text> : null}
            </Text>
          </Pressable>
        );
      })}
      <Text style={styles.small}>
        {requiredLeft === 0 ? 'All required items are ticked.' : `${requiredLeft} required item(s) left.`} Ticks are saved on this phone only.
      </Text>
    </Section>
  );
}

export default function CircularDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { areaName } = useIbasAreas();
  const [c, setC] = useState<CircularRecord | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      setC(await fetchCircular(id));
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

  const goCircular = (cid: string) => router.push(`/(app)/circulars/${cid}` as Href);
  const goList = (key: 'tag' | 'area' | 'collection', value: string) =>
    router.push(`/(app)/circulars?${key}=${encodeURIComponent(value)}` as Href);

  if (!c) {
    return (
      <View style={styles.center}>
        {error ? (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={18} color="#991b1b" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <ActivityIndicator size="large" color={CIR} />
        )}
      </View>
    );
  }

  const note = c.note?.trim();
  const orderBy = [c.order_by, c.order_by_designation].filter(Boolean).join(', ');

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      {error ? (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={18} color="#991b1b" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <View style={styles.pills}>
          <Pill label={docTypeLabel(c.doc_type)} tone="violet" />
          {!c.is_published ? <Pill label="Draft" tone="warning" /> : null}
          {c.superseded_by.length > 0 ? <Pill label="Superseded" tone="danger" /> : null}
        </View>
        <Text style={styles.no} selectable>
          {c.circular_no}
        </Text>
        <Text style={styles.title} selectable>
          {c.title}
        </Text>
        {c.title_bn ? (
          <Text style={styles.titleBn} selectable>
            {c.title_bn}
          </Text>
        ) : null}
        <Text style={styles.small}>
          {formatDdMmYyyy(c.issue_date)}
          {c.effective_date ? ` · effective ${formatDdMmYyyy(c.effective_date)}` : ''}
        </Text>
        {c.attachment_url || c.source_url ? (
          <View style={styles.btnRow}>
            {c.attachment_url ? (
              <Pressable style={({ pressed }) => [styles.btn, pressed && styles.pressed]} onPress={() => openHref(router, c.attachment_url!)}>
                <Ionicons name="document-attach" size={16} color={colors.white} />
                <Text style={styles.btnText}>Open document</Text>
              </Pressable>
            ) : null}
            {c.source_url ? (
              <Pressable style={({ pressed }) => [styles.btn, styles.btnOutline, pressed && styles.pressed]} onPress={() => openHref(router, c.source_url!)}>
                <Ionicons name="open-outline" size={16} color={CIR} />
                <Text style={[styles.btnText, styles.btnTextOutline]}>Official source</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {!c.is_published ? <Text style={styles.draft}>Draft — only admins can see this circular.</Text> : null}

      {c.superseded_by.length > 0 ? (
        <View style={styles.warn}>
          <View style={styles.sectionHead}>
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
        <Section icon="reader-outline" title="Summary">
          <Text style={styles.body} selectable>
            {c.summary}
          </Text>
        </Section>
      ) : null}

      {c.checklist && c.checklist.length > 0 ? <Checklist circularId={c.id} items={c.checklist} /> : null}

      {note ? (
        <Section icon="document-text-outline" title="Note" tone="note">
          {note.startsWith('<') ? <HtmlContent html={note} /> : <Text style={styles.body}>{note}</Text>}
        </Section>
      ) : null}

      <Section icon="newspaper-outline" title="Full text">
        {c.full_text ? (
          <HtmlContent html={c.full_text} />
        ) : (
          <Text style={styles.small}>
            Full text has not been added yet.{c.attachment_url ? ' Use “Open document” to read the original.' : ''}
          </Text>
        )}
      </Section>

      <Section icon="information-circle-outline" title="Details">
        <Meta label="Order / memo no." value={c.circular_no} mono />
        <Meta label="Document type" value={docTypeLabel(c.doc_type)} />
        <Meta label="Order date" value={formatDdMmYyyy(c.issue_date)} />
        <Meta label="Effective from" value={c.effective_date ? formatDdMmYyyy(c.effective_date) : undefined} />
        <Meta label="Issued by" value={issuerLabel(c.issuer)} />
        <Meta label="Ministry / division" value={c.ministry} />
        <Meta label="Department / office" value={c.department} />
        <Meta label="Wing / branch" value={c.issuer_detail} />
        <Meta label="Order by" value={orderBy || undefined} />
      </Section>

      {c.toolkit && c.toolkit.length > 0 ? (
        <Section icon="clipboard-outline" title="Related checklists">
          {c.toolkit.map((k) => (
            <Pressable key={k.id} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]} onPress={() => openHref(router, `/toolkit/${k.id}`)}>
              <Text style={styles.linkText}>
                {k.title}
                {!k.is_published ? <Text style={styles.optional}> (draft)</Text> : null}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </Section>
      ) : null}

      {c.collections.length > 0 || c.areas.length > 0 || c.tags.length > 0 ? (
        <Section icon="pricetags-outline" title="Filed under">
          {c.collections.length > 0 ? (
            <>
              <Text style={styles.metaLabel}>Policy collections</Text>
              <View style={styles.pills}>
                {c.collections.map((code) => (
                  <Pressable key={code} onPress={() => goList('collection', code)}>
                    <Pill label={collectionName(code)} tone="violet" />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {c.areas.length > 0 ? (
            <>
              <Text style={styles.metaLabel}>iBAS++ areas</Text>
              <View style={styles.pills}>
                {c.areas.map((code) => (
                  <Pressable key={code} onPress={() => goList('area', code)}>
                    <Pill label={areaName(code)} icon="briefcase-outline" />
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
          {c.tags.length > 0 ? (
            <View style={styles.pills}>
              {c.tags.map((t) => (
                <Pressable key={t} onPress={() => goList('tag', t)}>
                  <Text style={styles.tag}>#{t}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Section>
      ) : null}

      {c.supersedes.length > 0 ? (
        <Section icon="time-outline" title="Replaces">
          {c.supersedes.map((s) => (
            <Pressable key={s.id} style={({ pressed }) => [styles.linkRow, pressed && styles.pressed]} onPress={() => goCircular(s.id)}>
              <View style={styles.flex}>
                <Text style={[styles.small, styles.mono]}>{s.circular_no}</Text>
                <Text style={styles.linkText}>{s.title}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </Pressable>
          ))}
        </Section>
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
  center: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  pressed: {
    opacity: 0.8,
  },
  flex: {
    flex: 1,
  },
  card: {
    gap: spacing.sm,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
  },
  noteCard: {
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
  },
  no: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'monospace',
    color: colors.textMuted,
  },
  mono: {
    fontFamily: 'monospace',
  },
  title: {
    fontSize: 19,
    fontWeight: '800',
    lineHeight: 26,
    color: colors.text,
  },
  titleBn: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.textMuted,
  },
  small: {
    fontSize: 12,
    lineHeight: 17,
    color: colors.textMuted,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.text,
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
    backgroundColor: CIR,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  btnOutline: {
    backgroundColor: CIR_SOFT,
  },
  btnText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
  btnTextOutline: {
    color: CIR,
  },
  draft: {
    fontSize: 13,
    color: '#92400e',
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    padding: spacing.sm + 4,
    overflow: 'hidden',
  },
  warn: {
    gap: spacing.sm,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#fde68a',
    backgroundColor: '#fffbeb',
    padding: spacing.md,
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
  optional: {
    fontSize: 12,
    color: colors.textMuted,
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
  metaLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.textMuted,
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
  tag: {
    fontSize: 12,
    fontWeight: '600',
    color: CIR,
    backgroundColor: CIR_SOFT,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    overflow: 'hidden',
  },
  errorBox: {
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
});
