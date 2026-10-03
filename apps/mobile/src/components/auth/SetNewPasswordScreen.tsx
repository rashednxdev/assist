import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { colors, spacing } from '@/theme';

/** Shown instead of the app after signing in with an admin-issued temporary password. */
export function SetNewPasswordScreen() {
  const { user, refreshUser, signOut } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/account/set-new-password', {
        method: 'POST',
        body: JSON.stringify({ new_password: password, confirm_password: confirmPassword }),
      });
      await refreshUser();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your password. Please try again.');
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell title="Set your new password">
      <View style={styles.highlight}>
        <Ionicons name="key-outline" size={20} color={colors.primary} />
        <Text style={styles.highlightText}>
          {user?.full_name_en ? `Welcome back, ${user.full_name_en}. ` : ''}You signed in with a temporary password from the admin.
          Choose your own password to continue.
        </Text>
      </View>
      <TextField
        label="New password"
        value={password}
        onChangeText={setPassword}
        secureToggle
        secureTextEntry
        placeholder="Min. 8 characters"
      />
      <TextField
        label="Confirm new password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureToggle
        secureTextEntry
        placeholder="Repeat password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Save and continue" onPress={handleSubmit} loading={loading} />
      <Button title="Sign out" variant="secondary" onPress={() => void signOut()} disabled={loading} />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  highlight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(15, 92, 140, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(15, 92, 140, 0.2)',
    borderRadius: 12,
    padding: spacing.md,
  },
  highlightText: { flex: 1, fontSize: 14, lineHeight: 20, color: colors.text },
  error: { color: colors.error, fontSize: 14 },
});
