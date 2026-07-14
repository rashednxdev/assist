import { Text, StyleSheet, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';
import { stripHtml } from '@/lib/book-display';
import { colors } from '@/theme';

/** Plain-text content with list-marker line breaks + justified text (books & questions). */
export function BookRichText({
  html,
  style,
  ...rest
}: {
  html?: string | null;
  style?: StyleProp<TextStyle>;
} & Omit<TextProps, 'children' | 'style'>) {
  const stripped = stripHtml(html ?? undefined);
  if (!stripped) return null;
  const plain = insertBookListMarkerLineBreaks(stripped, '\n');
  return (
    <Text style={[styles.plain, style]} {...rest}>
      {plain}
    </Text>
  );
}

const styles = StyleSheet.create({
  plain: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'justify',
  },
});
