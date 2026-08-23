import { View, Text, StyleSheet, ScrollView, useWindowDimensions } from 'react-native';
import {
  hasComparisonTableContent,
  hasProcessContent,
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
  slides: LiveStreamSlide[];
  classTopic?: string;
}

/** Stacked presentation pages — one slide card under the next. */
export function LiveClassPresentation({ slides, classTopic }: LiveClassPresentationProps) {
  const { height } = useWindowDimensions();
  const minPage = Math.max(420, Math.round(height * 0.72));

  if (slides.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No presentation yet</Text>
        <Text style={styles.emptyBody}>
          When the admin publishes class slides, they will appear here page by page.
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
        Class presentation · {slides.length} slide{slides.length === 1 ? '' : 's'}
      </Text>
      {slides.map((slide, index) => {
        const typo = slideTypography(slide.title, slide.context);
        const hasTable = hasComparisonTableContent(slide.table);
        const hasProcess = hasProcessContent(slide.process);
        return (
          <View key={`slide-${index}`} style={[styles.page, { minHeight: minPage }]}>
            <Text style={styles.pageIndex}>
              {index + 1} / {slides.length}
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
              <View style={styles.processPanel}>
                {slide.process?.title?.trim() &&
                slide.process.title.trim().toLowerCase() !== 'process' ? (
                  <Text style={styles.processTitle}>{slide.process.title}</Text>
                ) : null}
                {slide.process?.details?.trim() ? (
                  <BookRichText html={slide.process.details} style={styles.processDetails} />
                ) : null}
                <ProcessFlowPreview steps={slide.process?.steps} />
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.lg,
  },
  classTopic: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textMuted,
    textAlign: 'center',
  },
  deckLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9d174d',
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  page: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#fbcfe8',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
    justifyContent: 'center',
    shadowColor: '#be185d',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  pageIndex: {
    alignSelf: 'center',
    fontSize: 12,
    fontWeight: '800',
    color: colors.textMuted,
    letterSpacing: 0.4,
    marginBottom: spacing.sm,
  },
  slideTitle: {
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  slideContext: {
    color: colors.text,
    textAlign: 'justify',
  },
  block: {
    marginTop: spacing.sm,
    width: '100%',
  },
  processPanel: {
    marginTop: spacing.sm,
    width: '100%',
    gap: spacing.sm,
    backgroundColor: colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  processTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  processDetails: {
    fontSize: 16,
    lineHeight: 26,
    color: colors.text,
  },
  empty: {
    padding: spacing.xl,
    gap: spacing.sm,
    alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  emptyBody: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
