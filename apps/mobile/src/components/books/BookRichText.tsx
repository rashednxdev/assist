import { Text, View, StyleSheet, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';
import { stripHtml } from '@/lib/book-display';
import { colors } from '@/theme';

type LineAlign = 'justify' | 'center' | 'rightHalf';

interface MarkupLine {
  text: string;
  align: LineAlign;
}

/**
 * Admin-entered line-break markup, recognized anywhere in content:
 * - "//" → new line (justified)
 * - consecutive "//" (optionally separated by spaces) → that many line breaks / blank lines
 * - "///" → new line, centered full width
 * - "////" → new line, centered in the right half of the screen
 * Longer markers are matched first. Markers are removed from the output.
 */
function splitMarkupLines(text: string): MarkupLine[] {
  const parts = text.split(/(\/{4}|\/{3}|\/{2})/);
  const lines: MarkupLine[] = [];
  let buffer = '';
  let align: LineAlign = 'justify';

  for (const part of parts) {
    if (part === '////' || part === '///' || part === '//') {
      lines.push({ text: buffer.trim(), align });
      buffer = '';
      if (part === '////') align = 'rightHalf';
      else if (part === '///') align = 'center';
      else align = 'justify';
      continue;
    }
    // Whitespace-only chunks between markers keep the buffer empty so the next
    // "//" pushes a blank line (N consecutive "//" → N line breaks).
    if (part.trim() === '') continue;
    buffer += part;
  }
  lines.push({ text: buffer.trim(), align });

  while (lines.length > 0 && lines[0].text.length === 0) lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].text.length === 0) lines.pop();
  return lines;
}

function lineTextStyle(align: LineAlign) {
  if (align === 'center' || align === 'rightHalf') return styles.center;
  return null;
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
  if (lines.length === 0) {
    return (
      <Text style={[styles.plain, style]} {...rest}>
        {plain.replace(/\/{2,}/g, '').trim()}
      </Text>
    );
  }
  if (lines.length === 1 && lines[0].align === 'justify') {
    return (
      <Text style={[styles.plain, style]} {...rest}>
        {lines[0].text}
      </Text>
    );
  }

  return (
    <View>
      {lines.map((line, i) => {
        if (!line.text) {
          return <View key={i} style={styles.blankLine} />;
        }
        const textNode = (
          <Text style={[styles.plain, style, lineTextStyle(line.align)]} {...rest}>
            {line.text}
          </Text>
        );
        if (line.align === 'rightHalf') {
          return (
            <View key={i} style={styles.rightHalf}>
              {textNode}
            </View>
          );
        }
        return <View key={i}>{textNode}</View>;
      })}
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
  rightHalf: {
    width: '50%',
    alignSelf: 'flex-end',
  },
  blankLine: {
    height: 24,
  },
});
