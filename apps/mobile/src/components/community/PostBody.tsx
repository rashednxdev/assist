import type { ReactNode } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '@/theme';

/*
 * Same light formatting as the web: paragraphs, **bold**, `code`, "- " / "1. " lists and bare https:// links.
 */

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <Text key={i} style={styles.bold}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <Text key={i} style={styles.code}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <Text key={i} style={styles.link} onPress={() => void Linking.openURL(part)}>
          {part}
        </Text>
      );
    }
    return part;
  });
}

type Block = { type: 'p'; lines: string[] } | { type: 'ul' | 'ol'; items: string[] };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const last = out[out.length - 1];
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol';
      const item = (ul ?? ol)![1]!;
      if (last && last.type === type) last.items.push(item);
      else out.push({ type, items: [item] });
    } else if (!line.trim()) {
      out.push({ type: 'p', lines: [] });
    } else if (last && last.type === 'p' && last.lines.length > 0) {
      last.lines.push(line);
    } else {
      out.push({ type: 'p', lines: [line] });
    }
  }
  return out.filter((b) => (b.type === 'p' ? b.lines.length > 0 : b.items.length > 0));
}

export function PostBody({ text }: { text: string }) {
  return (
    <View style={styles.wrap}>
      {blocks(text).map((b, i) =>
        b.type === 'p' ? (
          <Text key={i} style={styles.text} selectable>
            {b.lines.map((l, j) => (
              <Text key={j}>
                {j > 0 ? '\n' : ''}
                {inline(l)}
              </Text>
            ))}
          </Text>
        ) : (
          <View key={i} style={styles.list}>
            {b.items.map((it, j) => (
              <View key={j} style={styles.li}>
                <Text style={[styles.text, styles.marker]}>{b.type === 'ul' ? '•' : `${j + 1}.`}</Text>
                <Text style={[styles.text, styles.liText]} selectable>
                  {inline(it)}
                </Text>
              </View>
            ))}
          </View>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm + 2,
  },
  text: {
    fontSize: 15,
    lineHeight: 23,
    color: colors.text,
  },
  bold: {
    fontWeight: '800',
  },
  code: {
    fontFamily: 'monospace',
    fontSize: 13,
    backgroundColor: '#f1f5f9',
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  list: {
    gap: 4,
  },
  li: {
    flexDirection: 'row',
    gap: 6,
  },
  marker: {
    minWidth: 18,
    color: colors.textMuted,
  },
  liText: {
    flex: 1,
  },
});
