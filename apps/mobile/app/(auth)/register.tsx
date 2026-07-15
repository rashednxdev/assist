import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { register } from '@/lib/auth-api';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { colors, spacing } from '@/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({
    full_name_en: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRegister() {
    setError('');
    if (!form.full_name_en.trim() || form.full_name_en.trim().length < 2) {
      setError('Enter your full name (English).');
      return;
    }
    if (!/^01[3-9]\d{8}$/.test(form.phone.trim())) {
      setError('Enter a valid mobile number (01XXXXXXXXX).');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register({
        full_name_en: form.full_name_en.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        user_type: 'applicant',
        accept_terms: true,
      });
      await refreshUser();
      router.replace('/(app)/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell
      title="Create account"
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already registered?</Text>
          <Link href="/(auth)/login" asChild>
            <Pressable>
              <Text style={styles.footerLink}>Sign in</Text>
            </Pressable>
          </Link>
        </View>
      }
    >
      <TextField
        label="Full name (English)"
        value={form.full_name_en}
        onChangeText={(v) => setField('full_name_en', v)}
        autoCapitalize="words"
        placeholder="Your name"
      />
      <TextField
        label="Mobile"
        value={form.phone}
        onChangeText={(v) => setField('phone', v)}
        keyboardType="phone-pad"
        hint="01XXXXXXXXX"
        placeholder="01700000000"
      />
      <TextField
        label="Password"
        value={form.password}
        onChangeText={(v) => setField('password', v)}
        secureToggle
        secureTextEntry
        placeholder="Min. 8 characters"
      />
      <TextField
        label="Confirm password"
        value={form.confirm_password}
        onChangeText={(v) => setField('confirm_password', v)}
        secureToggle
        secureTextEntry
        placeholder="Repeat password"
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Create account" onPress={handleRegister} loading={loading} />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.error,
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginTop: spacing.lg,
  },
  footerText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  footerLink: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '700',
  },
});
