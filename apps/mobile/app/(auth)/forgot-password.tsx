import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { forgotPassword, isValidBdPhone, normalizeBdPhone } from '@/lib/auth-api';
import { ApiError } from '@/lib/api';
import { colors } from '@/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    const normalized = normalizeBdPhone(phone);
    if (!isValidBdPhone(normalized)) {
      setError('Enter a valid mobile number (01XXXXXXXXX).');
      return;
    }
    setLoading(true);
    try {
      const res = await forgotPassword(normalized);
      router.push({
        pathname: '/(auth)/reset-password',
        params: { phone: normalized, phoneHint: res.phone_hint },
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a reset code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell
      title="Forgot password"
      subtitle="Enter your mobile number. We will text a 6-digit OTP."
    >
      <TextField
        label="Mobile"
        value={phone}
        onChangeText={(v) => setPhone(normalizeBdPhone(v))}
        keyboardType="phone-pad"
        autoComplete="tel"
        hint="01XXXXXXXXX"
        placeholder="01700000000"
        maxLength={11}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Send OTP" onPress={handleSubmit} loading={loading} />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.error,
    fontSize: 14,
  },
});
