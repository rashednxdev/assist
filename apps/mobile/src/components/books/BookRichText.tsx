import { Text, StyleSheet } from 'react-native';
import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';
import { stripHtml } from '@/lib/book-display';
import { colors } from '@/theme';

/** Plain-text book content — reliable inside long ScrollViews. */
export function BookRichText({ html }: { html?: string }) {
  const stripped = stripHtml(html);
  if (!stripped) return null;
  const plain = insertBookListMarkerLineBreaks(stripped, '\n');
  return <Text style={styles.plain}>{plain}</Text>;
}

const styles = StyleSheet.create({
  plain: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'justify',
  },
});
