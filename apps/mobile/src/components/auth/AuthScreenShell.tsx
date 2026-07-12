import { ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

interface AuthScreenShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  variant?: 'default' | 'premium';
}

const PREMIUM_FEATURES = ['Exam prep', 'Question bank', 'Books & Tools', 'Practice papers'];

export function AuthScreenShell({
  title,
  subtitle,
  children,
  footer,
  variant = 'default',
}: AuthScreenShellProps) {
  const premium = variant === 'premium';

  return (
    <View style={[styles.root, premium && styles.rootPremium]}>
      <LinearGradient
        colors={
          premium
            ? [colors.premiumBg, '#0a2540', colors.primaryDark, '#123f5c']
            : [colors.primaryDark, colors.primary, colors.primaryLight]
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {premium ? (
          <>
            <View style={[styles.orb, styles.orbTop]} />
            <View style={[styles.orb, styles.orbBottom]} />
            <View style={styles.goldLine} />
          </>
        ) : null}
        <SafeAreaView edges={['top']}>
          <View style={styles.brandBlock}>
            <View style={[styles.logo, premium && styles.logoPremium]}>
              <Text style={[styles.logoText, premium && styles.logoTextPremium]}>PA</Text>
            </View>
            <Text style={[styles.brandTitle, premium && styles.brandTitlePremium]}>ProAssist</Text>
            <Text style={[styles.brandSub, premium && styles.brandSubPremium]}>
              SAS/SRAS exam preparation with ProAssist
            </Text>
            {premium ? (
              <View style={styles.featureRow}>
                {PREMIUM_FEATURES.map((label) => (
                  <View key={label} style={styles.featurePill}>
                    <Text style={styles.featurePillText}>{label}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </SafeAreaView>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.formArea}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, premium && styles.cardPremium]}>
            {premium ? <View style={styles.cardAccent} /> : null}
            <Text style={[styles.title, premium && styles.titlePremium]}>{title}</Text>
            <Text style={[styles.subtitle, premium && styles.subtitlePremium]}>{subtitle}</Text>
            {children}
          </View>
          {footer}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  rootPremium: {
    backgroundColor: colors.premiumBg,
  },
  hero: {
    paddingBottom: spacing.xl,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(212, 175, 55, 0.08)',
  },
  orbTop: {
    width: 220,
    height: 220,
    top: -60,
    right: -50,
  },
  orbBottom: {
    width: 160,
    height: 160,
    bottom: -40,
    left: -30,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  goldLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: colors.gold,
    opacity: 0.85,
  },
  brandBlock: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  logo: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    marginBottom: spacing.sm,
  },
  logoPremium: {
    backgroundColor: 'rgba(212, 175, 55, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.45)',
  },
  logoText: {
    color: colors.white,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 1,
  },
  logoTextPremium: {
    color: colors.goldLight,
  },
  premiumBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(212, 175, 55, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: spacing.sm,
  },
  premiumBadgeText: {
    color: colors.goldLight,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
  },
  brandTitle: {
    color: colors.white,
    fontSize: 32,
    fontWeight: '800',
  },
  brandTitlePremium: {
    fontSize: 36,
    letterSpacing: -0.5,
  },
  brandSub: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    marginTop: 4,
    maxWidth: 280,
  },
  brandSubPremium: {
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 20,
  },
  featureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: spacing.md,
  },
  featurePill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  featurePillText: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 11,
    fontWeight: '600',
  },
  formArea: {
    flex: 1,
    marginTop: -spacing.lg,
  },
  scroll: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.lg,
    shadowColor: '#0f172a',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
    gap: spacing.md,
  },
  cardPremium: {
    backgroundColor: colors.premiumSurface,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.22)',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 12,
    overflow: 'hidden',
  },
  cardAccent: {
    position: 'absolute',
    top: 0,
    left: spacing.lg,
    right: spacing.lg,
    height: 2,
    backgroundColor: colors.gold,
    borderRadius: 2,
    opacity: 0.9,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
  },
  titlePremium: {
    color: colors.white,
    marginTop: spacing.xs,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  subtitlePremium: {
    color: 'rgba(255,255,255,0.62)',
  },
});
