import { View, Text, StyleSheet } from 'react-native';
import { BookRichText } from '@/components/books/BookRichText';
import type { ExplanationSection } from '@/types/questions';
import { colors } from '@/theme';

/**
 * Read-only renderer for a list of title/details/note sections — the same presentation used for
 * a question's model answer / explanation, reused here so any "sections" content (e.g. Terms &
 * Conditions) looks and behaves identically wherever it's shown.
 */
export function ExplanationSectionsView({ sections }: { sections: ExplanationSection[] }) {
  return (
    <>
      {sections.map((sec, idx) => (
        <View key={idx} style={styles.sectionBlock}>
          {sec.title?.trim() ? <Text style={styles.sectionHeading}>{sec.title}</Text> : null}
          {sec.details?.trim() ? <BookRichText html={sec.details} style={styles.sectionText} /> : null}
          {sec.note?.trim() ? <BookRichText html={sec.note} style={styles.sectionNote} /> : null}
          {sec.subsections?.map((sub, i) => (
            <View key={i} style={styles.subsectionBlock}>
              {sub.subtitle?.trim() ? <Text style={styles.subsectionTitle}>{sub.subtitle}</Text> : null}
              {sub.details?.trim() ? <BookRichText html={sub.details} style={styles.sectionText} /> : null}
              {sub.note?.trim() ? <BookRichText html={sub.note} style={styles.sectionNote} /> : null}
            </View>
          ))}
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  sectionBlock: {
    gap: 4,
    paddingVertical: 4,
  },
  sectionHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  sectionNote: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  subsectionBlock: {
    marginTop: 4,
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    gap: 2,
  },
  subsectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
});
