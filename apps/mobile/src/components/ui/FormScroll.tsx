import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardScrollProvider, useKeyboardScroll } from '@/lib/keyboard-scroll';
import { colors, spacing } from '@/theme';

interface FormScrollProps {
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** ScrollView that keeps the focused TextField above the keyboard. */
export function FormScroll(props: FormScrollProps) {
  return (
    <KeyboardScrollProvider>
      <Inner {...props} />
    </KeyboardScrollProvider>
  );
}

function Inner({ children, contentStyle, refreshing, onRefresh }: FormScrollProps) {
  const keyboardScroll = useKeyboardScroll();
  return (
    <ScrollView
      ref={keyboardScroll?.scrollRef}
      style={styles.root}
      contentContainerStyle={[styles.content, contentStyle, { paddingBottom: spacing.xl * 2 + (keyboardScroll?.keyboardInset ?? 0) }]}
      onScroll={keyboardScroll?.onScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
  },
});
