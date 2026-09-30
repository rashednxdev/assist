import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { AccessRequiredScreen } from '@/components/home/AccessRequiredScreen';
import { useAuth } from '@/lib/auth-context';
import { useModuleOpener } from '@/hooks/useModuleOpener';
import { isModuleEffectivelyStopped } from '@/lib/api';
import { PENSION_TOOLS } from '@/lib/home-modules';
import { colors, spacing } from '@/theme';

const DETAILS: Record<string, { icon: keyof typeof Ionicons.glyphMap; points: string[] }> = {
  pension: {
    icon: 'wallet-outline',
    points: ['Leave account & lamp grant', 'Net pension & gratuity'],
  },
  'joining-period': {
    icon: 'airplane-outline',
    points: ['Preparation + travel days', 'Transfer / posting joining time'],
  },
};

export default function CalculationsHubScreen() {
  const router = useRouter();
  const { user, canAccess } = useAuth();
  const { openModule, checkingModuleId, accessScreen, closeAccessScreen } = useModuleOpener();

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <LinearGradient colors={['#0b3d2e', '#047857']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="calculator" size={26} color={colors.white} />
          </View>
          <View style={styles.flex}>
            <Text style={styles.heroTitle}>Salary On 2026 & Calculations</Text>
            <Text style={styles.heroSub}>Pay, pension and joining-time calculators for government service.</Text>
          </View>
        </LinearGradient>

        <Row
          icon="cash-outline"
          color="#047857"
          title="Salary On 2026"
          subtitle="Basic on proposed pay scale 2026"
          points={['Stage-wise basic & allowances', 'বাংলা ও English']}
          onPress={() => router.push('/(app)/salary' as Href)}
        />

        {PENSION_TOOLS.map((m) => {
          const enabled =
            canAccess(m.code) &&
            !isModuleEffectivelyStopped(user?.module_stops ?? [], user?.module_access ?? [], m.code);
          const d = DETAILS[m.id];
          return (
            <Row
              key={m.id}
              icon={d?.icon ?? m.icon}
              color={m.color}
              title={m.title}
              subtitle={m.subtitle}
              points={d?.points ?? []}
              locked={!enabled}
              checking={checkingModuleId === m.id}
              onPress={() => void openModule(m)}
            />
          );
        })}
      </ScrollView>

      <AccessRequiredScreen
        visible={accessScreen !== null}
        variant={accessScreen?.variant ?? 'denied'}
        moduleTitle={accessScreen?.moduleTitle}
        stoppedReason={accessScreen?.stoppedReason}
        unpaidMessage={user?.unpaid_message}
        onClose={closeAccessScreen}
      />
    </View>
  );
}

function Row({
  icon,
  color,
  title,
  subtitle,
  points,
  locked = false,
  checking = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  subtitle: string;
  points: string[];
  locked?: boolean;
  checking?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, locked && styles.rowLocked, pressed && styles.pressed]}
      onPress={onPress}
      disabled={checking}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={[styles.rowIcon, { backgroundColor: `${color}1f` }]}>
        {checking ? <ActivityIndicator size="small" color={color} /> : <Ionicons name={icon} size={24} color={color} />}
      </View>
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.rowSub}>{subtitle}</Text>
        {points.map((p) => (
          <View key={p} style={styles.point}>
            <Ionicons name="checkmark-circle" size={13} color={color} />
            <Text style={styles.pointText}>{p}</Text>
          </View>
        ))}
        {locked ? <Text style={styles.lock}>Tap to check access</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 18,
    padding: spacing.md,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.white,
  },
  heroSub: {
    fontSize: 12,
    lineHeight: 17,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  rowLocked: {
    opacity: 0.75,
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  rowIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  rowSub: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
    marginBottom: 4,
  },
  point: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  pointText: {
    fontSize: 12,
    color: colors.text,
  },
  lock: {
    fontSize: 11,
    color: colors.warning,
    fontWeight: '600',
    marginTop: 4,
  },
});
