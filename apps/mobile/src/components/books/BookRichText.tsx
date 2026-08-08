import { Text, View, StyleSheet, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';
import { stripHtml } from '@/lib/book-display';
import { colors } from '@/theme';

interface MarkupLine {
  text: string;
  align: 'justify' | 'center';
}

/**
 * Admin-entered line-break markup, recognized anywhere in the content: "//" starts a new line
 * (justified, same as the default), and "///" also starts a new line but centers it — e.g. for a
 * heading-like line inside a paragraph. The marker itself is removed from the output. "///" is
 * matched before "//" in the split regex since it's a superset of that pattern.
 */
function splitMarkupLines(text: string): MarkupLine[] {
  const parts = text.split(/(\/{3}|\/{2})/);
  const lines: MarkupLine[] = [];
  let buffer = '';
  let align: MarkupLine['align'] = 'justify';
  for (const part of parts) {
    if (part === '///' || part === '//') {
      lines.push({ text: buffer.trim(), align });
      buffer = '';
      align = part === '///' ? 'center' : 'justify';
    } else {
      buffer += part;
    }
  }
  lines.push({ text: buffer.trim(), align });
  return lines.filter((line) => line.text.length > 0);
}

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

  if (!plain.includes('//')) {
    return (
      <Text style={[styles.plain, style]} {...rest}>
        {plain}
      </Text>
    );
  }

  const lines = splitMarkupLines(plain);
  if (lines.length <= 1) {
    return (
      <Text style={[styles.plain, style]} {...rest}>
        {lines[0]?.text ?? plain}
      </Text>
    );
  }

  return (
    <View>
      {lines.map((line, i) => (
        <Text
          key={i}
          style={[styles.plain, style, line.align === 'center' && styles.center]}
          {...rest}
        >
          {line.text}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  plain: {
    fontSize: 15,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'justify',
  },
  center: {
    textAlign: 'center',
  },
});
