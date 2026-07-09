import { View, Text, StyleSheet, Linking } from 'react-native';
import { colors, spacing } from '@/theme';

/** Pension calculator is available on web for now. */
export default function PensionMobileScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Pension Calculator</Text>
      <Text style={styles.body}>
        Leave account and lamp grant calculation is available in the web app under Learning → Pension
        calculator.
      </Text>
      <Text style={styles.link} onPress={() => void Linking.openURL('http://localhost:3000/pension')}>
        Open on web
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.textMuted,
  },
  link: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
});
