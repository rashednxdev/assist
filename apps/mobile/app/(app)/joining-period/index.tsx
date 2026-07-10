import { View, Text, StyleSheet, Linking } from 'react-native';
import { colors, spacing } from '@/theme';

/** Joining period calculator is available on web for now. */
export default function JoiningPeriodMobileScreen() {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>Joining Period</Text>
      <Text style={styles.body}>
        Transfer and posting joining-time calculation is available in the web app under Learning →
        Joining period.
      </Text>
      <Text
        style={styles.link}
        onPress={() => void Linking.openURL('http://localhost:3000/joining-period')}
      >
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
