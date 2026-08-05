import { useState } from 'react';
import { Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { forgotPassword } from '@/lib/auth-api';
import { ApiError } from '@/lib/api';
import { colors } from '@/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    setError('');
    if (!/^01[3-9]\d{8}$/.test(phone.trim())) {
      setError('Enter a valid mobile number (01XXXXXXXXX).');
      return;
    }
    setLoading(true);
    try {
      const trimmed = phone.trim();
      const res = await forgotPassword(trimmed);
      router.push({
        pathname: '/(auth)/reset-password',
        params: { phone: trimmed, emailHint: res.email_hint },
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
      subtitle="Enter your mobile number — we'll email a reset code to the address on your account."
    >
      <TextField
        label="Mobile"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        autoComplete="tel"
        hint="01XXXXXXXXX"
        placeholder="01700000000"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Send reset code" onPress={handleSubmit} loading={loading} />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.error,
    fontSize: 14,
  },
});
