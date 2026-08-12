import { Linking, Modal, Pressable, StatusBar, Text, View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '@/theme';

const WHATSAPP_DISPLAY_NUMBER = '01911 120 610';
const WHATSAPP_INTL_NUMBER = '8801911120610';

export type AccessRequiredVariant = 'denied' | 'network-error' | 'stopped' | 'unpaid';

interface AccessRequiredScreenProps {
  visible: boolean;
  variant: AccessRequiredVariant;
  moduleTitle?: string;
  stoppedReason?: string;
  onClose: () => void;
}

const COPY: Record<
  AccessRequiredVariant,
  { icon: keyof typeof Ionicons.glyphMap; title: string; body: (moduleTitle?: string, stoppedReason?: string) => string }
> = {
  denied: {
    icon: 'lock-closed',
    title: 'Access Required',
    body: (moduleTitle) =>
      `${moduleTitle ?? 'This module'} isn't enabled for your account yet. Message us on WhatsApp and we'll turn it on for you.`,
  },
  'network-error': {
    icon: 'cloud-offline',
    title: 'Connection Problem',
    body: () =>
      `We couldn't verify your access right now. Check your connection, or message us on WhatsApp if this keeps happening.`,
  },
  stopped: {
    icon: 'pause-circle',
    title: 'Temporarily Unavailable',
    body: (moduleTitle, stoppedReason) =>
      stoppedReason?.trim() || `${moduleTitle ?? 'This module'} is temporarily unavailable. Please check back later.`,
  },
  unpaid: {
    icon: 'card',
    title: 'Pay to Get Access Module',
    body: (moduleTitle) =>
      `Pay to unlock ${moduleTitle ?? 'this module'} and other learning content. Message us on WhatsApp to complete payment.`,
  },
};

export function AccessRequiredScreen({
  visible,
  variant,
  moduleTitle,
  stoppedReason,
  onClose,
}: AccessRequiredScreenProps) {
  const copy = COPY[variant];

  function openWhatsApp() {
    const text = encodeURIComponent(
      variant === 'unpaid'
        ? `Hi, I'd like to pay to get access to "${moduleTitle ?? 'a module'}" on ProAssist.`
        : variant === 'denied'
          ? `Hi, I'd like to request access to "${moduleTitle ?? 'a module'}" on ProAssist.`
          : `Hi, I'm having trouble connecting to ProAssist and need help.`,
    );
    Linking.openURL(`https://wa.me/${WHATSAPP_INTL_NUMBER}?text=${text}`).catch(() => {
      /* ignore — nothing sensible to show if the link fails to open */
    });
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <StatusBar barStyle="light-content" backgroundColor={colors.premiumBg} />
      <View style={styles.root}>
        <LinearGradient
          colors={[colors.premiumBg, '#0a2540', colors.primaryDark, '#123f5c']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={[styles.orb, styles.orbTop]} />
        <View style={[styles.orb, styles.orbBottom]} />
        <View style={[styles.orb, styles.orbMid]} />

        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={12}>
            <Ionicons name="close" size={22} color="rgba(255,255,255,0.85)" />
          </Pressable>

          <View style={styles.content}>
            <View style={styles.iconRing}>
              <View style={styles.iconCircle}>
                <Ionicons name={copy.icon} size={40} color={colors.goldLight} />
              </View>
            </View>

            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.body}>{copy.body(moduleTitle, stoppedReason)}</Text>

            {variant !== 'stopped' ? (
              <>
                <View style={styles.divider} />

                <Pressable
                  style={({ pressed }) => [styles.waButton, pressed && styles.waButtonPressed]}
                  onPress={openWhatsApp}
                  accessibilityRole="button"
                  accessibilityLabel="Contact on WhatsApp"
                >
                  <Ionicons name="logo-whatsapp" size={24} color={colors.white} />
                  <Text style={styles.waButtonText}>Contact on WhatsApp</Text>
                </Pressable>
                <Text style={styles.waNumber}>{WHATSAPP_DISPLAY_NUMBER}</Text>
              </>
            ) : null}

            <Pressable onPress={onClose} hitSlop={10} style={styles.laterBtn}>
              <Text style={styles.laterText}>{variant === 'stopped' ? 'Got it' : 'Maybe later'}</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.premiumBg,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbTop: {
    width: 280,
    height: 280,
    top: -80,
    right: -70,
    backgroundColor: 'rgba(212, 175, 55, 0.1)',
  },
  orbBottom: {
    width: 220,
    height: 220,
    bottom: -60,
    left: -50,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  orbMid: {
    width: 160,
    height: 160,
    top: '38%',
    left: -60,
    backgroundColor: 'rgba(37, 211, 102, 0.08)',
  },
  safeArea: {
    flex: 1,
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginRight: spacing.lg,
    marginTop: spacing.sm,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
    marginTop: -spacing.xl,
  },
  iconRing: {
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: 'rgba(212, 175, 55, 0.14)',
    borderWidth: 1,
    borderColor: 'rgba(212, 175, 55, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.white,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    maxWidth: 320,
    marginTop: spacing.xs,
  },
  divider: {
    width: 48,
    height: 2,
    backgroundColor: colors.gold,
    opacity: 0.85,
    borderRadius: 2,
    marginVertical: spacing.lg,
  },
  waButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#25D366',
    borderRadius: 999,
    paddingHorizontal: spacing.xl,
    paddingVertical: 16,
    minWidth: 260,
    shadowColor: '#25D366',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  waButtonPressed: {
    opacity: 0.88,
  },
  waButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '800',
  },
  waNumber: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    letterSpacing: 0.5,
  },
  laterBtn: {
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  laterText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.5)',
    textDecorationLine: 'underline',
  },
});
