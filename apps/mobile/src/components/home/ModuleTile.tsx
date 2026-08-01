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
  /** Short inspirational message shown as a speech bubble just right of the icon. */
  badgeText?: string;
  onPress: () => void;
}

export function ModuleTile({
  title,
  subtitle,
  icon,
  color,
  enabled,
  checking = false,
  badgeText,
  onPress,
}: ModuleTileProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, !enabled && styles.tileDisabled, pressed && styles.pressed]}
      onPress={onPress}
      disabled={checking}
    >
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${color}22` }]}>
          {checking ? (
            <ActivityIndicator size="small" color={color} />
          ) : (
            <Ionicons name={icon} size={26} color={color} />
          )}
        </View>
        {badgeText ? (
          <View style={styles.speechBubble}>
            <View style={styles.speechTail} />
            <Text style={styles.speechText} numberOfLines={2}>
              {badgeText}
            </Text>
          </View>
        ) : null}
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
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speechBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: 10,
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  speechTail: {
    position: 'absolute',
    left: -4,
    top: '50%',
    marginTop: -4,
    width: 8,
    height: 8,
    backgroundColor: '#fffbeb',
    borderLeftWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#fde68a',
    transform: [{ rotate: '45deg' }],
  },
  speechText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#92400e',
    flexShrink: 1,
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
