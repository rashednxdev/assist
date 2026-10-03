import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TEMP_PASSWORD_TTL_HOURS, type TempPasswordResult } from '@ibas/shared-types';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { setUserTempPassword } from '@/lib/users-api';
import { colors, spacing } from '@/theme';

export interface TempPasswordTarget {
  id: string;
  full_name_en: string;
  phone: string;
  status?: string;
  bound_device_label?: string | null;
}

function expiryText(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function TempPasswordSheet({
  user,
  onClose,
  onDone,
}: {
  user: TempPasswordTarget;
  onClose: () => void;
  onDone?: (result: TempPasswordResult) => void;
}) {
  const [password, setPassword] = useState('');
  const [clearDevice, setClearDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TempPasswordResult | null>(null);

  async function submit() {
    setBusy(true);
    setError('');
    try {
      const r = await setUserTempPassword(user.id, {
        password: password.trim() || undefined,
        clear_bound_device: clearDevice || undefined,
      });
      setResult(r);
      onDone?.(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set the temporary password');
    } finally {
      setBusy(false);
    }
  }

  function share() {
    if (!result) return;
    void Share.share({
      message: `Hi ${user.full_name_en}, your ProAssist temporary password is ${result.temp_password} . Sign in with your mobile number and this password, then set your own new password. It works until ${expiryText(result.expires_at)}.`,
    });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={() => !busy && onClose()}>
      <Pressable style={styles.backdrop} onPress={() => !busy && onClose()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.head}>
            <Ionicons name="key-outline" size={22} color={colors.primary} />
            <View style={styles.flex}>
              <Text style={styles.title}>Temporary password</Text>
              <Text style={styles.sub}>
                {user.full_name_en} · {user.phone}
              </Text>
            </View>
            <Pressable onPress={onClose} disabled={busy} hitSlop={10}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          {result ? (
            <View style={styles.body}>
              <Text style={styles.success}>Done. The account is active again and every old session was signed out.</Text>
              <Text style={styles.label}>Temporary password</Text>
              <Text selectable style={styles.password}>
                {result.temp_password}
              </Text>
              <Text style={styles.sub}>Works until {expiryText(result.expires_at)}. It is shown only now.</Text>
              <Text style={styles.sub}>
                The user signs in with their mobile number and this password, then must set their own new password.
              </Text>
              <Button title="Share with user" onPress={share} />
              <Button title="Close" variant="secondary" onPress={onClose} />
            </View>
          ) : (
            <View style={styles.body}>
              <Text style={styles.sub}>
                Reactivates the account{user.status && user.status !== 'active' ? ` (now ${user.status})` : ''}, clears any
                wrong-password lock and signs out every device. Works for {TEMP_PASSWORD_TTL_HOURS} hours; the user must replace
                it right after signing in.
              </Text>
              <TextField
                label="Temporary password"
                value={password}
                onChangeText={setPassword}
                placeholder="Leave blank to generate one"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={styles.switchRow}>
                <View style={styles.flex}>
                  <Text style={styles.switchLabel}>Also clear the bound device</Text>
                  <Text style={styles.sub}>
                    {user.bound_device_label ? `Now bound to: ${user.bound_device_label}` : 'Use when the user is on a new phone'}
                  </Text>
                </View>
                <Switch value={clearDevice} onValueChange={setClearDevice} />
              </View>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button title="Set temporary password" onPress={() => void submit()} loading={busy} />
            </View>
          )}
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)' },
  sheet: { backgroundColor: colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  sub: { fontSize: 12, color: colors.textMuted, lineHeight: 18 },
  body: { padding: spacing.md, gap: spacing.sm },
  label: { fontSize: 13, fontWeight: '700', color: colors.text },
  password: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingVertical: 12,
    textAlign: 'center',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  success: { fontSize: 13, color: '#065f46', backgroundColor: '#ecfdf5', borderRadius: 10, padding: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  switchLabel: { fontSize: 14, fontWeight: '600', color: colors.text },
  error: { color: colors.error, fontSize: 13 },
});
