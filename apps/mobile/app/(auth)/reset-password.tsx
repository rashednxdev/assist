import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { forgotPassword, resetPassword } from '@/lib/auth-api';
import { ApiError } from '@/lib/api';
import { colors, spacing } from '@/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { phone: phoneParam, emailHint } = useLocalSearchParams<{ phone?: string; emailHint?: string }>();
  const phone = phoneParam ?? '';

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function handleSubmit() {
    setError('');
    setMessage('');
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
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
      await resetPassword({
        phone,
        code: code.trim(),
        new_password: password,
        confirm_password: confirmPassword,
      });
      router.replace('/(auth)/login');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not reset your password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setMessage('');
    setResending(true);
    try {
      await forgotPassword(phone);
      // The old code is now invalid on the server — clear it so a stale value can't be submitted.
      setCode('');
      setMessage('A new code was sent — enter that one (the old code no longer works).');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthScreenShell title="Reset password">
      <View style={styles.highlight}>
        <Ionicons name="mail-unread-outline" size={20} color={colors.primary} />
        <Text style={styles.highlightText}>
          Enter the code we sent to{' '}
          {emailHint ? <Text style={styles.highlightEmail}>{emailHint}</Text> : 'your email'}
        </Text>
      </View>

      <TextField
        label="Reset code"
        value={code}
        onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
        keyboardType="number-pad"
        placeholder="••••••"
        style={styles.codeInput}
      />

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
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <Button title="Reset password" onPress={handleSubmit} loading={loading} />
      <Button
        title={resending ? 'Resending…' : 'Resend code'}
        variant="secondary"
        onPress={handleResend}
        loading={resending}
      />
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
  highlightText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  highlightEmail: {
    fontWeight: '800',
    color: colors.primary,
  },
  codeInput: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 14,
    textAlign: 'center',
    paddingVertical: spacing.sm,
  },
  error: {
    color: colors.error,
    fontSize: 14,
  },
  message: {
    color: colors.primary,
    fontSize: 14,
    marginTop: -spacing.xs,
  },
});
