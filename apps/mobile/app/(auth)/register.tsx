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
    full_name_bn: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    accept_terms: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleRegister() {
    setError('');
    if (!form.accept_terms) {
      setError('Please accept the terms to continue.');
      return;
    }
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await register({
        ...form,
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
      subtitle="Free registration for exam candidates. Start with Books, Questions, Exams & Papers."
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
        label="Full name (Bengali)"
        value={form.full_name_bn}
        onChangeText={(v) => setField('full_name_bn', v)}
        hint="Optional"
        placeholder="আপনার নাম"
      />
      <TextField
        label="Email"
        value={form.email}
        onChangeText={(v) => setField('email', v)}
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@example.com"
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

      <Pressable style={styles.termsRow} onPress={() => setField('accept_terms', !form.accept_terms)}>
        <View style={[styles.checkbox, form.accept_terms && styles.checkboxOn]}>
          {form.accept_terms ? <Text style={styles.checkMark}>✓</Text> : null}
        </View>
        <Text style={styles.termsText}>
          I agree to the terms of use and privacy policy for iBAS Learn.
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Create account" onPress={handleRegister} loading={loading} />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkMark: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  termsText: {
    flex: 1,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 18,
  },
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
