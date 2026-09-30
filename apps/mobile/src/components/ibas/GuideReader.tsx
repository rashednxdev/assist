import { useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ToolkitItemDetail } from '@ibas/shared-types';
import { HtmlContent } from '@/components/books/HtmlContent';
import { IbasCard, RefChips, SectionHead } from '@/components/ibas/IbasBits';
import { colors, spacing } from '@/theme';

/** Sections must render as direct children of the screen's ScrollView so `onJump` offsets line up. */
export function GuideReader({ item, code, color, onJump }: { item: ToolkitItemDetail; code: string; color: string; onJump: (y: number) => void }) {
  const sections = item.sections ?? [];
  const offsets = useRef<Record<string, number>>({});

  return (
    <>
      {sections.length > 1 ? (
        <IbasCard>
          <SectionHead icon="list-outline" title="Contents" color={color} />
          {sections.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => onJump(offsets.current[s.id] ?? 0)}
              style={({ pressed }) => [styles.tocRow, pressed && styles.pressed]}
            >
              <Text style={[styles.tocNo, { color }]}>{i + 1}.</Text>
              <Text style={styles.tocText}>{s.heading}</Text>
              <Ionicons name="arrow-down" size={14} color={colors.textMuted} />
            </Pressable>
          ))}
        </IbasCard>
      ) : null}

      {sections.map((s, i) => (
        <View key={s.id} onLayout={(e) => (offsets.current[s.id] = e.nativeEvent.layout.y)}>
          <IbasCard>
            <View style={styles.head}>
              <View style={[styles.num, { backgroundColor: color }]}>
                <Text style={styles.numText}>{i + 1}</Text>
              </View>
              <Text style={styles.heading}>{s.heading}</Text>
            </View>
            <HtmlContent html={s.body} />
            <RefChips code={code} refs={s.refs} color={color} />
          </IbasCard>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  tocRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingVertical: 6,
  },
  tocNo: {
    fontSize: 13,
    fontWeight: '800',
    minWidth: 20,
  },
  tocText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  num: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.white,
  },
  heading: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
    color: colors.text,
  },
});
