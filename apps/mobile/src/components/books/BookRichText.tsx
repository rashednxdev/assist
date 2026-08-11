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
 * - "[]" inside a line → left side left-aligned, right side right-aligned (middle empty)
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

/** Split on the first `[]` in a line into left / right halves. */
function splitBracketSides(text: string): { left: string; right: string } | null {
  const idx = text.indexOf('[]');
  if (idx < 0) return null;
  return {
    left: text.slice(0, idx).trim(),
    right: text.slice(idx + 2).trim(),
  };
}

function lineTextStyle(align: LineAlign) {
  if (align === 'center' || align === 'rightHalf') return styles.center;
  return null;
}

function renderLineContent(
  line: MarkupLine,
  style: StyleProp<TextStyle> | undefined,
  rest: Omit<TextProps, 'children' | 'style'>,
  key: number,
) {
  if (!line.text) {
    return <View key={key} style={styles.blankLine} />;
  }

  const sides = splitBracketSides(line.text);
  if (sides) {
    return (
      <View key={key} style={styles.splitRow}>
        <Text style={[styles.plain, styles.splitLeft, style]} {...rest}>
          {sides.left}
        </Text>
        <Text style={[styles.plain, styles.splitRight, style]} {...rest}>
          {sides.right}
        </Text>
      </View>
    );
  }

  const textNode = (
    <Text style={[styles.plain, style, lineTextStyle(line.align)]} {...rest}>
      {line.text}
    </Text>
  );
  if (line.align === 'rightHalf') {
    return (
      <View key={key} style={styles.rightHalf}>
        {textNode}
      </View>
    );
  }
  return <View key={key}>{textNode}</View>;
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

  const needsMarkup = plain.includes('//') || plain.includes('[]');
  if (!needsMarkup) {
    return (
      <Text style={[styles.plain, style]} {...rest}>
        {plain}
      </Text>
    );
  }

  const lines = plain.includes('//')
    ? splitMarkupLines(plain)
    : [{ text: plain.trim(), align: 'justify' as const }];

  if (lines.length === 0) {
    return (
      <Text style={[styles.plain, style]} {...rest}>
        {plain.replace(/\/{2,}/g, '').replace(/\[\]/g, '').trim()}
      </Text>
    );
  }

  if (
    lines.length === 1 &&
    lines[0].align === 'justify' &&
    !lines[0].text.includes('[]')
  ) {
    return (
      <Text style={[styles.plain, style]} {...rest}>
        {lines[0].text}
      </Text>
    );
  }

  return <View>{lines.map((line, i) => renderLineContent(line, style, rest, i))}</View>;
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
  splitRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  splitLeft: {
    flex: 1,
    textAlign: 'left',
    paddingRight: 6,
  },
  splitRight: {
    flex: 1,
    textAlign: 'right',
    paddingLeft: 6,
  },
  blankLine: {
    height: 24,
  },
});
