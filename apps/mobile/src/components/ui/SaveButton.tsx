import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/theme';

interface SaveButtonProps {
  saved: boolean;
  onPress: () => void;
  size?: number;
}

/** Facebook-style bookmark save control. */
export function SaveButton({ saved, onPress, size = 22 }: SaveButtonProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.btn, saved && styles.btnSaved, pressed && styles.pressed]}
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Remove from saved' : 'Save'}
    >
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={size}
        color={saved ? colors.primary : colors.textMuted}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    padding: 4,
    borderRadius: 8,
  },
  btnSaved: {
    backgroundColor: '#e8f2fa',
  },
  pressed: {
    opacity: 0.75,
  },
});
