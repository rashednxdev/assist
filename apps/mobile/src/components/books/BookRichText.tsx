import { Text, View, StyleSheet, type StyleProp, type TextProps, type TextStyle } from 'react-native';
import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';
import { stripHtml } from '@/lib/book-display';
import { colors } from '@/theme';

type LineAlign = 'justify' | 'center' | 'rightHalf' | 'rule' | 'ruleRightHalf';

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
 * - "/--" → horizontal rule across the right half of the screen
 * - "/---" → full-width horizontal rule
 * - "*text*" → bold the word or sentence between asterisks
 * - "[]" inside a line → left side left-aligned, right side right-aligned (middle empty)
 * Longer markers are matched first. Markers are removed from the output.
 */
function splitMarkupLines(text: string): MarkupLine[] {
  const parts = text.split(/(\/{4}|\/{3}|\/---|\/--|\/{2})/);
  const lines: MarkupLine[] = [];
  let buffer = '';
  let align: LineAlign = 'justify';

  for (const part of parts) {
    if (part === '////' || part === '///' || part === '/---' || part === '/--' || part === '//') {
      lines.push({ text: buffer.trim(), align });
      buffer = '';
      if (part === '/---') {
        lines.push({ text: '', align: 'rule' });
        align = 'justify';
      } else if (part === '/--') {
        lines.push({ text: '', align: 'ruleRightHalf' });
        align = 'justify';
      } else if (part === '////') {
        align = 'rightHalf';
      } else if (part === '///') {
        align = 'center';
      } else {
        align = 'justify';
      }
      continue;
    }
    // Whitespace-only chunks between markers keep the buffer empty so the next
    // "//" pushes a blank line (N consecutive "//" → N line breaks).
    if (part.trim() === '') continue;
    buffer += part;
  }
  lines.push({ text: buffer.trim(), align });

  while (
    lines.length > 0 &&
    lines[0].text.length === 0 &&
    lines[0].align !== 'rule' &&
    lines[0].align !== 'ruleRightHalf'
  ) {
    lines.shift();
  }
  while (
    lines.length > 0 &&
    lines[lines.length - 1].text.length === 0 &&
    lines[lines.length - 1].align !== 'rule' &&
    lines[lines.length - 1].align !== 'ruleRightHalf'
  ) {
    lines.pop();
  }
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

function hasBoldMarkup(text: string) {
  return /\*[^*]+\*/.test(text);
}

/** Render plain text with optional *bold* segments as nested Text nodes. */
function renderInlineParts(text: string) {
  if (!hasBoldMarkup(text)) return text;
  const parts = text.split(/(\*[^*]+\*)/g);
  return parts.map((part, i) => {
    const bold = part.match(/^\*([^*]+)\*$/);
    if (bold) {
      return (
        <Text key={i} style={styles.bold}>
          {bold[1]}
        </Text>
      );
    }
    return part ? <Text key={i}>{part}</Text> : null;
  });
}

function InlineMarkup({
  text,
  style,
  alignStyle,
  ...rest
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  alignStyle?: StyleProp<TextStyle>;
} & Omit<TextProps, 'children' | 'style'>) {
  // Keep list-marker `\n` breaks (1. / (ক) / ।) even when bold spans the line.
  if (!hasBoldMarkup(text) && !text.includes('\n')) {
    return (
      <Text style={[styles.plain, style, alignStyle]} {...rest}>
        {text}
      </Text>
    );
  }

  return (
    <Text style={[styles.plain, style, alignStyle]} {...rest}>
      {renderInlineParts(text)}
    </Text>
  );
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
  if (line.align === 'rule') {
    return <View key={key} style={styles.ruleLine} />;
  }
  if (line.align === 'ruleRightHalf') {
    return <View key={key} style={styles.ruleLineRightHalf} />;
  }
  if (!line.text) {
    return <View key={key} style={styles.blankLine} />;
  }

  const sides = splitBracketSides(line.text);
  if (sides) {
    return (
      <View key={key} style={styles.splitRow}>
        <InlineMarkup text={sides.left} style={[styles.splitLeft, style]} {...rest} />
        <InlineMarkup text={sides.right} style={[styles.splitRight, style]} {...rest} />
      </View>
    );
  }

  const textNode = (
    <InlineMarkup text={line.text} style={style} alignStyle={lineTextStyle(line.align)} {...rest} />
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

  const needsMarkup =
    plain.includes('//') ||
    plain.includes('/--') ||
    plain.includes('[]') ||
    hasBoldMarkup(plain);
  if (!needsMarkup) {
    return (
      <Text style={[styles.plain, style]} {...rest}>
        {plain}
      </Text>
    );
  }

  const lines =
    plain.includes('//') || plain.includes('/--')
      ? splitMarkupLines(plain)
      : [{ text: plain.trim(), align: 'justify' as const }];

  if (lines.length === 0) {
    return (
      <Text style={[styles.plain, style]} {...rest}>
        {plain.replace(/\/{2,}/g, '').replace(/\/-{2,}/g, '').replace(/\[\]/g, '').trim()}
      </Text>
    );
  }

  if (
    lines.length === 1 &&
    lines[0].align === 'justify' &&
    !lines[0].text.includes('[]')
  ) {
    return <InlineMarkup text={lines[0].text} style={style} {...rest} />;
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
  bold: {
    fontWeight: '700',
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
  ruleLine: {
    alignSelf: 'stretch',
    width: '100%',
    height: 2,
    marginVertical: 10,
    backgroundColor: colors.text,
  },
  ruleLineRightHalf: {
    width: '50%',
    alignSelf: 'flex-end',
    height: 2,
    marginVertical: 10,
    backgroundColor: colors.text,
  },
});
