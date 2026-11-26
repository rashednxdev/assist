import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MobileAppVersionPolicy } from '@ibas/shared-types';
import { APP_UPDATE_URL, APP_VERSION_LABEL, isMobileForceUpdateRequired } from '@/lib/app-version';
import { fetchMobileVersionPolicy } from '@/lib/mobile-version-api';
import { colors, spacing } from '@/theme';

/**
 * Blocks the entire app when the server latest major.minor (first two version
 * segments) is newer than this install — prior lines are absolute until update.
 */
export function ForceUpdateGate({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [policy, setPolicy] = useState<MobileAppVersionPolicy | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      const next = await fetchMobileVersionPolicy(APP_VERSION_LABEL);
      setPolicy(next);
    } catch (err) {
      // Network failure: do not lock users out if the policy endpoint is unreachable.
      setError(err instanceof Error ? err.message : 'Could not check for updates');
      setPolicy(null);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  const force =
    policy != null &&
    (policy.force_update || isMobileForceUpdateRequired(APP_VERSION_LABEL, policy.latest_version));

  if (checking && !policy && !error) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (force && policy) {
    const url = policy.update_url?.trim() || APP_UPDATE_URL;
    return (
      <SafeAreaView style={styles.blockRoot} edges={['top', 'bottom']}>
        <View style={styles.blockCard}>
          <Text style={styles.blockEyebrow}>Update required</Text>
          <Text style={styles.blockTitle}>New ProAssist version</Text>
          <Text style={styles.blockBody}>
            {policy.force_message?.trim() ||
              'A required update is available. Please install the latest version to continue.'}
          </Text>
          <Text style={styles.blockMeta}>
            Installed {APP_VERSION_LABEL.replace(/^ProAssist\./i, '')} · Required line{' '}
            {policy.latest_line} ({policy.latest_version.replace(/^ProAssist\./i, '')})
          </Text>
          <Pressable
            style={styles.primaryBtn}
            onPress={() => void Linking.openURL(url)}
            accessibilityRole="button"
            accessibilityLabel="Update app"
          >
            <Text style={styles.primaryBtnText}>Update now</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => void check()}>
            <Text style={styles.secondaryBtnText}>I updated — check again</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  blockRoot: {
    flex: 1,
    backgroundColor: colors.background,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  blockCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  blockEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.warning,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  blockTitle: { fontSize: 22, fontWeight: '800', color: colors.text },
  blockBody: { fontSize: 15, lineHeight: 22, color: colors.textMuted, marginTop: 4 },
  blockMeta: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
});
