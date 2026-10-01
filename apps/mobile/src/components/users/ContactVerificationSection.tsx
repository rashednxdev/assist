import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ContactPersonRef, UserContactVerification } from '@ibas/shared-types';
import { Button } from '@/components/ui/Button';
import { fetchUserContactVerification, revokeUserContactVerification } from '@/lib/users-api';
import { formatDate } from '@/lib/profile-api';
import { colors, spacing } from '@/theme';

const STATUS_LABEL = { pending: 'Waiting for verification', verified: 'Verified', legacy: 'Verified (existing member)' } as const;

function who(p: ContactPersonRef | null | undefined): string {
  if (!p) return '—';
  return [p.name, p.designation, p.office].filter(Boolean).join(', ');
}

/** Admin view: who verified this user for Contacts, and whom they verified. */
export function ContactVerificationSection({ userId }: { userId: string }) {
  const [data, setData] = useState<UserContactVerification | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchUserContactVerification(userId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load'));
  }, [userId]);

  function confirmRevoke() {
    Alert.alert('Revoke verification?', 'The user goes back to step 2 with a new code and needs a colleague to verify them again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Revoke',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            setData(await revokeUserContactVerification(userId));
          } catch (e) {
            Alert.alert('Could not revoke', e instanceof Error ? e.message : 'Try again');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  }

  const v = data?.verification;
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.primary} />
        <Text style={styles.title}>Contacts verification</Text>
      </View>
      {error ? (
        <Text style={styles.error}>{error}</Text>
      ) : !data ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <>
          <Text style={styles.line}>
            Status: <Text style={styles.strong}>{v ? STATUS_LABEL[v.status] : 'Office & designation not set'}</Text>
          </Text>
          {v?.status === 'pending' && v.code ? <Text style={styles.line}>Code: {v.code}</Text> : null}
          {v?.status === 'verified' ? (
            <Text style={styles.line}>
              Verified by <Text style={styles.strong}>{who(v.verifier)}</Text>
              {v.verified_at ? ` on ${formatDate(v.verified_at)}` : ''}
            </Text>
          ) : null}
          {v && v.status !== 'pending' ? (
            <Button title="Revoke verification" variant="secondary" onPress={confirmRevoke} loading={busy} />
          ) : null}
          <Text style={styles.sub}>VERIFIED USERS ({data.verified_users.length})</Text>
          {data.verified_users.length === 0 ? (
            <Text style={styles.muted}>Has not verified anyone.</Text>
          ) : (
            data.verified_users.map((r) => (
              <View key={r.id} style={styles.row}>
                <Text style={styles.rowText} numberOfLines={2}>
                  {who(r.person)}
                </Text>
                <Text style={styles.muted}>{formatDate(r.verified_at)}</Text>
              </View>
            ))
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.sm + 4,
    gap: 8,
    backgroundColor: colors.surface,
    marginTop: spacing.sm,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
  },
  line: {
    fontSize: 13,
    color: colors.text,
  },
  strong: {
    fontWeight: '700',
  },
  sub: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: colors.textMuted,
    marginTop: 4,
  },
  muted: {
    fontSize: 12,
    color: colors.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  rowText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
  },
  error: {
    fontSize: 13,
    color: colors.error,
  },
});
