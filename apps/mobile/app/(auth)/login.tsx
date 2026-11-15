import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { AuthScreenShell } from '@/components/auth/AuthScreenShell';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { login, resendLoginOtp, verifyLoginOtp } from '@/lib/auth-api';
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
  const [challenge, setChallenge] = useState('');
  const [phoneHint, setPhoneHint] = useState('');
  const [code, setCode] = useState('');
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function handleLogin() {
    setError('');
    if (!email.trim() || !password) {
      setError('Enter your mobile number and password.');
      return;
    }
    setLoading(true);
    try {
      const result = await login(email.trim(), password);
      if ('otp_required' in result && result.otp_required) {
        setPassword('');
        setChallenge(result.challenge);
        setPhoneHint(result.phone_hint);
        setCode('');
        setResendIn(60);
        return;
      }
      await refreshUser();
      router.replace('/(app)/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp() {
    setError('');
    if (code.length !== 6) {
      setError('Enter the 6-digit code.');
      return;
    }
    setLoading(true);
    try {
      await verifyLoginOtp(challenge, code);
      await refreshUser();
      router.replace('/(app)/home');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'That code is not correct.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const next = await resendLoginOtp(challenge);
      setChallenge(next.challenge);
      setPhoneHint(next.phone_hint);
      setResendIn(60);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send a new code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenShell
      variant="premium"
      title={challenge ? 'Enter the code' : 'Welcome back'}
      subtitle={challenge ? `Sent to ${phoneHint}. It expires in 5 minutes.` : 'Sign in to your preparation dashboard'}
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
      {challenge ? (
        <>
          <TextField
            label="Verification code"
            variant="premium"
            value={code}
            onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="sms-otp"
            maxLength={6}
            placeholder="6-digit code"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button title="Verify and sign in" variant="premium" onPress={handleOtp} loading={loading} />
          <Pressable disabled={loading || resendIn > 0} onPress={() => void handleResend()} style={styles.forgotLink}>
            <Text style={styles.forgotLinkText}>{resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}</Text>
          </Pressable>
        </>
      ) : (
        <>
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
        </>
      )}
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
