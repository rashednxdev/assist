import { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { login } from '@/lib/auth-api';
import { useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { colors, spacing } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your mobile number and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
      await refreshUser();
      router.replace('/(app)/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell
      variant="premium"
      title="Welcome back"
      subtitle="Sign in to your preparation dashboard"
      footer={
        <View style={styles.footer}>
          <Text style={styles.footerText}>New to ProAssist?</Text>
          <Link href="/(auth)/register" asChild>
            <Pressable style={styles.footerLinkBtn}>
              <Text style={styles.footerLink}>Create new account</Text>
            </Pressable>
          </Link>
        </View>
      }
    >
      <TextField
        label="Mobile"
        variant="premium"
        value={email}
        onChangeText={setEmail}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="01700000000"
      />
      <TextField
        label="Password"
        variant="premium"
        value={password}
        onChangeText={setPassword}
        secureToggle
        secureTextEntry
        autoComplete="password"
        placeholder="••••••••"
      />
      <Link href="/(auth)/forgot-password" asChild>
        <Pressable style={styles.forgotLink}>
          <Text style={styles.forgotLinkText}>Forgot password?</Text>
        </Pressable>
      </Link>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title="Sign in" variant="premium" onPress={handleLogin} loading={loading} />
      {loading ? (
        <Text style={styles.loadingHint}>Connecting to server — this may take a moment on first load.</Text>
      ) : null}
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  forgotLink: {
    alignSelf: 'flex-end',
    marginTop: -spacing.xs,
  },
  forgotLinkText: {
    color: colors.goldLight,
    fontSize: 13,
    fontWeight: '700',
  },
  error: {
    color: '#f87171',
    fontSize: 14,
  },
  loadingHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    textAlign: 'center',
    marginTop: -4,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: spacing.lg,
  },
  footerText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 14,
  },
  footerLinkBtn: {
    borderWidth: 1.5,
    borderColor: colors.goldLight,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  footerLink: {
    color: colors.goldLight,
    fontSize: 14,
    fontWeight: '800',
  },
});
