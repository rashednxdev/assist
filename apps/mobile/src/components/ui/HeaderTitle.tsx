import { StyleSheet, Text, useWindowDimensions } from 'react-native';
import { colors } from '@/theme';

/** Room taken by the back button and header side padding. */
const HEADER_SIDE_SPACE = 120;

/**
 * Stack header title rendered as a React view. The native Android title keeps the previous
 * screen's width when a longer title is pushed, so long titles get cut off on entry.
 */
export function HeaderTitle({ text, color = colors.white }: { text: string; color?: string }) {
  const { width } = useWindowDimensions();
  return (
    <Text
      style={[styles.title, { color, maxWidth: Math.max(120, width - HEADER_SIDE_SPACE) }]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
});
