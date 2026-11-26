import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { forgotPassword, resetPassword, verifyResetCode } from '@/lib/auth-api';
import { ApiError } from '@/lib/api';
import { colors, spacing } from '@/theme';

const RESEND_COOLDOWN_SEC = 60;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { phone: phoneParam, phoneHint } = useLocalSearchParams<{ phone?: string; phoneHint?: string }>();
  const phone = phoneParam ?? '';

  const [step, setStep] = useState<'otp' | 'password'>('otp');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SEC);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function handleVerifyOtp() {
    setError('');
    setMessage('');
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit OTP from the text message.');
      return;
    }
    setLoading(true);
    try {
      await verifyResetCode(phone, code.trim());
      setStep('password');
      setMessage('Code verified. Set your new password.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code is not correct.');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResetPassword() {
    setError('');
    setMessage('');
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
    if (cooldown > 0) return;
    setError('');
    setMessage('');
    setResending(true);
    try {
      await forgotPassword(phone);
      setCode('');
      setStep('otp');
      setCooldown(RESEND_COOLDOWN_SEC);
      setMessage('A new OTP was sent — the previous code no longer works.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not resend the code.');
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthScreenShell title={step === 'otp' ? 'Enter OTP' : 'Set new password'}>
      <View style={styles.highlight}>
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
        <Text style={styles.highlightText}>
          {step === 'otp' ? 'Enter the OTP we texted to ' : 'Creating a new password for '}
          {phoneHint ? <Text style={styles.highlightEmail}>{phoneHint}</Text> : 'your mobile'}
        </Text>
      </View>

      {step === 'otp' ? (
        <>
          <TextField
            label="OTP code"
            value={code}
            onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="••••••"
            style={styles.codeInput}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
          <Button title="Verify OTP" onPress={handleVerifyOtp} loading={loading} />
          <Button
            title={
              resending
                ? 'Resending…'
                : cooldown > 0
                  ? `Resend OTP (${cooldown}s)`
                  : 'Resend OTP'
            }
            variant="secondary"
            onPress={handleResend}
            loading={resending}
            disabled={cooldown > 0 || resending}
          />
        </>
      ) : (
        <>
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
          <Button title="Reset password" onPress={handleResetPassword} loading={loading} />
          <Button
            title="Back to OTP"
            variant="secondary"
            onPress={() => {
              setStep('otp');
              setError('');
              setMessage('');
            }}
          />
        </>
      )}
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
