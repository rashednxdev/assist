import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import {
  hasComparisonTableContent,
  hasProcessContent,
  normalizeLiveStreamPresentations,
  type LiveStreamPresentation,
  type LiveStreamSlide,
} from '@ibas/shared-types';
import { BookRichText } from '@/components/books/BookRichText';
import { ProcessFlowPreview } from '@/components/books/ProcessFlowPreview';
import { ComparisonTablePreview } from '@/components/questions/ComparisonTablePreview';
import { colors, spacing } from '@/theme';

/** Scale title/body fonts from slide length so short slides feel bold on screen. */
export function slideTypography(title: string, context: string) {
  const len = `${title}\n${context}`.trim().length;
  if (len < 100) return { title: 34, body: 24, lineHeight: 36 };
  if (len < 280) return { title: 30, body: 22, lineHeight: 34 };
  if (len < 600) return { title: 26, body: 20, lineHeight: 32 };
  if (len < 1100) return { title: 24, body: 18, lineHeight: 30 };
  return { title: 22, body: 17, lineHeight: 28 };
}

interface LiveClassPresentationProps {
  presentations?: LiveStreamPresentation[];
  /** @deprecated Prefer `presentations`. */
  slides?: LiveStreamSlide[];
  classTopic?: string;
}

/** One or more presentation decks — tabs when multiple. */
export function LiveClassPresentation({
  presentations,
  slides,
  classTopic,
}: LiveClassPresentationProps) {
  const { height } = useWindowDimensions();
  const minPage = Math.max(420, Math.round(height * 0.72));
  const decks = useMemo(
    () => normalizeLiveStreamPresentations({ presentations, slides }),
    [presentations, slides],
  );
  const [active, setActive] = useState(0);
  const current = decks[Math.min(active, Math.max(decks.length - 1, 0))];

  if (decks.length === 0 || !current) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No presentation yet</Text>
        <Text style={styles.emptyBody}>
          When the admin publishes class presentations, they will appear here page by page.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator
    >
      {classTopic ? <Text style={styles.classTopic}>{classTopic}</Text> : null}
      <Text style={styles.deckLabel}>
        {decks.length > 1
          ? `${decks.length} presentations`
          : `Class presentation · ${current.slides.length} slide${
              current.slides.length === 1 ? '' : 's'
            }`}
      </Text>
      {decks.length > 1 ? (
        <View style={styles.tabs}>
          {decks.map((deck, index) => (
            <Pressable
              key={`deck-${index}-${deck.title}`}
              style={[styles.tab, index === active && styles.tabActive]}
              onPress={() => setActive(index)}
            >
              <Text
                style={[styles.tabText, index === active && styles.tabTextActive]}
                numberOfLines={1}
              >
                {deck.title || `Presentation ${index + 1}`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {decks.length > 1 ? (
        <Text style={styles.activeTitle}>
          {current.title} · {current.slides.length} slide
          {current.slides.length === 1 ? '' : 's'}
        </Text>
      ) : null}
      {current.slides.map((slide, index) => {
        const typo = slideTypography(slide.title, slide.context);
        const hasTable = hasComparisonTableContent(slide.table);
        const hasProcess = hasProcessContent(slide.process);
        return (
          <View key={`slide-${active}-${index}`} style={[styles.page, { minHeight: minPage }]}>
            <Text style={styles.pageIndex}>
              {index + 1} / {current.slides.length}
            </Text>
            {slide.title?.trim() ? (
              <BookRichText
                html={slide.title}
                style={[styles.slideTitle, { fontSize: typo.title, lineHeight: typo.title + 8 }]}
              />
            ) : null}
            {slide.context?.trim() ? (
              <BookRichText
                html={slide.context}
                style={[
                  styles.slideContext,
                  { fontSize: typo.body, lineHeight: typo.lineHeight },
                ]}
              />
            ) : null}
            {hasTable ? (
              <View style={styles.block}>
                <ComparisonTablePreview table={slide.table} />
              </View>
            ) : null}
            {hasProcess ? (
              <View style={styles.block}>
                <ProcessFlowPreview steps={slide.process?.steps ?? []} />
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  classTopic: { fontSize: 18, fontWeight: '800', color: colors.text },
  deckLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    textTransform: 'uppercase',
  },
  activeTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: { backgroundColor: '#fce7f3', borderColor: '#f9a8d4' },
  tabText: { fontSize: 13, fontWeight: '700', color: colors.textMuted, maxWidth: 160 },
  tabTextActive: { color: '#9d174d' },
  page: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pageIndex: { fontSize: 12, fontWeight: '800', color: colors.textMuted },
  slideTitle: { fontWeight: '800', color: colors.text },
  slideContext: { color: colors.text },
  block: { marginTop: spacing.sm },
  empty: { padding: spacing.lg, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: colors.text },
  emptyBody: { fontSize: 14, lineHeight: 20, color: colors.textMuted },
});
