import { Text, StyleSheet } from 'react-native';
import { stripHtml } from '@/lib/book-display';
import { colors } from '@/theme';

/** Plain-text book content — reliable inside long ScrollViews. */
export function BookRichText({ html }: { html?: string }) {
  const plain = stripHtml(html);
  if (!plain) return null;
  return <Text style={styles.plain}>{plain}</Text>;
}

const styles = StyleSheet.create({
  plain: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
  },
});
