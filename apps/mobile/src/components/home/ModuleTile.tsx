import { Pressable, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

interface ModuleTileProps {
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  enabled: boolean;
  checking?: boolean;
  onPress: () => void;
}

export function ModuleTile({
  title,
  subtitle,
  icon,
  color,
  enabled,
  checking = false,
  onPress,
}: ModuleTileProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, !enabled && styles.tileDisabled, pressed && styles.pressed]}
      onPress={onPress}
      disabled={checking}
    >
      <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
        {checking ? (
          <ActivityIndicator size="small" color={color} />
        ) : (
          <Ionicons name={icon} size={26} color={color} />
        )}
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      {!enabled ? <Text style={styles.lock}>Tap to check access</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: '46%',
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  tileDisabled: {
    opacity: 0.7,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 16,
  },
  lock: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 2,
  },
});
