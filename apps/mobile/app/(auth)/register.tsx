import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { register, resendRegistrationCode, verifyRegistration } from '@/lib/auth-api';
import { markModuleWelcomeTipsPending } from '@/lib/module-welcome-tips';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { colors, spacing } from '@/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [form, setForm] = useState({
    full_name_en: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [phoneHint, setPhoneHint] = useState('');
  const [code, setCode] = useState('');

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
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      setError('Enter a valid email address — it’s used to reset your password if you forget it.');
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
    if (!acceptedTerms) {
      setError('Please confirm that you want to register.');
      return;
    }
    setLoading(true);
    try {
      const res = await register({
        full_name_en: form.full_name_en.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        user_type: 'applicant',
        accept_terms: acceptedTerms,
      });
      setPhoneHint(res.phone_hint);
      setCode('');
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify() {
    setError('');
    if (code.trim().length !== 6) {
      setError('Enter the 6-digit code from the text message.');
      return;
    }
    setLoading(true);
    try {
      await verifyRegistration(form.phone.trim(), code.trim());
      await markModuleWelcomeTipsPending();
      await refreshUser();
      router.replace('/(app)/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code is not correct.');
      setCode('');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setError('');
    setLoading(true);
    try {
      const res = await resendRegistrationCode(form.phone.trim());
      setPhoneHint(res.phone_hint);
      setCode('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a new code.');
    } finally {
      setLoading(false);
    }
  }

  if (step === 'otp') {
    return (
      <AuthScreenShell
        title="Enter the code"
        subtitle={`A 6-digit code was sent to ${phoneHint || 'your mobile'}. It expires in 15 minutes.`}
      >
        <TextField
          label="Registration code"
          value={code}
          onChangeText={(v) => setCode(v.replace(/[^0-9]/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="••••••"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button title="Verify and continue" onPress={handleVerify} loading={loading} />
        <Button title="Resend code" variant="secondary" onPress={handleResend} loading={loading} />
      </AuthScreenShell>
    );
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
        label="Email"
        value={form.email}
        onChangeText={(v) => setField('email', v)}
        keyboardType="email-address"
        autoCapitalize="none"
        hint="Used to reset your password if you forget it"
        placeholder="you@example.com"
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

      <Pressable
        style={styles.termsRow}
        onPress={() => setAcceptedTerms((v) => !v)}
        hitSlop={6}
      >
        <Ionicons
          name={acceptedTerms ? 'checkbox' : 'square-outline'}
          size={22}
          color={acceptedTerms ? colors.primary : colors.textMuted}
        />
        <Text style={styles.termsText}>
          I want to register.
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button
        title="Create account"
        onPress={handleRegister}
        loading={loading}
        disabled={!acceptedTerms}
      />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  termsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginTop: spacing.xs,
  },
  termsText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#b71c1c',
    lineHeight: 19,
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
