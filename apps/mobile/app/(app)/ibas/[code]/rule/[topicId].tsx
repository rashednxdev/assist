import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { BookRichText } from '@/components/books/BookRichText';
import { HtmlContent } from '@/components/books/HtmlContent';
import { RuleContentLinkButton } from '@/components/books/RuleContentLinkButton';
import { TopicComparisonTable } from '@/components/books/TopicComparisonTable';
import { ProcessFlowPreview } from '@/components/books/ProcessFlowPreview';
import { Badge, IbasCard, IbasErrorScreen, IbasLoading, ibasStyles, SectionHead } from '@/components/ibas/IbasBits';
import { chapterHeading, ruleHeading, subRuleHeading } from '@/lib/book-display';
import { fetchBookReaderOutline, fetchTopicDetail } from '@/lib/books-api';
import { areaHref, fetchAreaRule, type AreaRuleDetail } from '@/lib/ibas-api';
import { useIbasAreas } from '@/lib/ibas-areas';
import type { ReaderRuleNav } from '@/types/books';
import { colors, spacing } from '@/theme';

type RuleData = Omit<AreaRuleDetail, 'book_id' | 'source'> & { book_id?: string; source?: string };

function Regulation({ reg, color }: { reg: RuleData['regulations'][number]; color: string }) {
  const [open, setOpen] = useState(false);
  const text = reg.full_text?.trim();
  return (
    <View style={styles.subCard}>
      <Pressable onPress={() => text && setOpen(!open)} style={styles.regHead} accessibilityRole="button" accessibilityState={{ expanded: open }}>
        <Text style={[styles.regTitle, { color }]}>
          {reg.regulation_no} — {reg.title}
        </Text>
        {text ? <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} /> : null}
      </Pressable>
      {open && text ? text.startsWith('<') ? <HtmlContent html={text} /> : <BookRichText html={text} /> : null}
    </View>
  );
}

export default function AreaRuleScreen() {
  const router = useRouter();
  const { code, topicId, book } = useLocalSearchParams<{ code: string; topicId: string; book?: string }>();
  const { areaColor } = useIbasAreas();
  const [rule, setRule] = useState<RuleData | null>(null);
  const [nav, setNav] = useState<ReaderRuleNav[]>([]);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!code || !topicId) return;
    try {
      if (book) {
        const [topic, outline] = await Promise.all([fetchTopicDetail(topicId), fetchBookReaderOutline(book).catch(() => null)]);
        setRule(topic);
        setNav(outline?.rules ?? []);
      } else {
        setRule(await fetchAreaRule(code, topicId));
      }
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load this rule');
    }
  }, [code, topicId, book]);

  useEffect(() => {
    void load();
  }, [load]);

  async function refresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  const accent = code ? areaColor(code) : colors.primary;
  if (!rule || !code) return error ? <IbasErrorScreen message={error} /> : <IbasLoading color={accent} />;

  const heading = ruleHeading(rule);
  const idx = nav.findIndex((r) => r.id === rule.id);
  const prev = idx > 0 ? nav[idx - 1] : undefined;
  const next = idx >= 0 && idx < nav.length - 1 ? nav[idx + 1] : undefined;
  const goRule = (id: string) => router.replace(areaHref(code, 'rule', id, `book=${book}`));
  const source = rule.source || (rule.chapter ? chapterHeading({ chapter_number: rule.chapter.chapter_number, name: rule.chapter.name }) : '');

  return (
    <>
      <Stack.Screen options={{ title: 'Rule' }} />
      <ScrollView style={ibasStyles.root} contentContainerStyle={ibasStyles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
        <IbasCard accent={accent}>
          {source ? <Text style={ibasStyles.kicker}>{source.toUpperCase()}</Text> : null}
          <View style={styles.titleRow}>
            <Text style={[ibasStyles.title, styles.flex]} selectable>
              {heading}
            </Text>
            {rule.is_amended ? <Badge label="Amended" color={colors.warning} /> : null}
          </View>
          {rule.sub_name ? <Text style={ibasStyles.titleBn}>{rule.sub_name}</Text> : null}

          {rule.description?.trim() ? <BookRichText html={rule.description} selectable /> : null}
          {rule.note?.trim() ? (
            <View style={styles.noteBox}>
              <Text style={ibasStyles.label}>Note</Text>
              <BookRichText html={rule.note} selectable />
            </View>
          ) : null}

          <RuleContentLinkButton contentLink={rule.content_link} title={heading} />
          <TopicComparisonTable table={rule.table} title={heading} />

          {rule.details.map((d) => (
            <View key={d.id} style={styles.detail}>
              <BookRichText html={d.detail_text} selectable />
            </View>
          ))}
        </IbasCard>

        {(rule.processes ?? []).length > 0 ? (
          <IbasCard>
            <SectionHead icon="git-branch-outline" title="Process" color={accent} />
            {(rule.processes ?? []).map((p) => (
              <View key={p.id} style={styles.subCard}>
                {p.title?.trim() && p.title.trim().toLowerCase() !== 'process' ? <Text style={styles.subTitle}>{p.title}</Text> : null}
                {p.details?.trim() ? <BookRichText html={p.details} /> : null}
                <ProcessFlowPreview steps={p.steps} />
              </View>
            ))}
          </IbasCard>
        ) : null}

        {rule.sub_topics.length > 0 ? (
          <IbasCard>
            <SectionHead icon="list-outline" title="Sub-rules" color={accent} />
            {rule.sub_topics.map((st) => (
              <View key={st.id} style={styles.subCard}>
                <Text style={styles.subTitle}>{subRuleHeading(st)}</Text>
                {st.description?.trim() ? <BookRichText html={st.description} selectable /> : null}
                {st.note?.trim() ? (
                  <View style={styles.noteBox}>
                    <Text style={ibasStyles.label}>Note</Text>
                    <BookRichText html={st.note} />
                  </View>
                ) : null}
              </View>
            ))}
          </IbasCard>
        ) : null}

        {rule.regulations.length > 0 ? (
          <IbasCard>
            <SectionHead icon="document-text-outline" title="Linked regulations" color={accent} />
            {rule.regulations.map((r) => (
              <Regulation key={r.id} reg={r} color={accent} />
            ))}
          </IbasCard>
        ) : null}

        {prev || next ? (
          <View style={styles.navRow}>
            {prev ? (
              <Pressable style={styles.navBtn} onPress={() => goRule(prev.id)}>
                <Ionicons name="chevron-back" size={18} color={accent} />
                <Text style={[styles.navText, { color: accent }]} numberOfLines={2}>
                  {ruleHeading(prev)}
                </Text>
              </Pressable>
            ) : (
              <View style={styles.flex} />
            )}
            {next ? (
              <Pressable style={[styles.navBtn, styles.navNext]} onPress={() => goRule(next.id)}>
                <Text style={[styles.navText, styles.navTextRight, { color: accent }]} numberOfLines={2}>
                  {ruleHeading(next)}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={accent} />
              </Pressable>
            ) : (
              <View style={styles.flex} />
            )}
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  noteBox: {
    gap: 4,
    borderRadius: 12,
    backgroundColor: colors.background,
    padding: spacing.sm,
  },
  detail: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  subCard: {
    gap: 6,
    borderRadius: 12,
    backgroundColor: colors.background,
    padding: spacing.sm,
  },
  subTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  regHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  regTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  navBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
  },
  navNext: {
    justifyContent: 'flex-end',
  },
  navText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  navTextRight: {
    textAlign: 'right',
  },
});
