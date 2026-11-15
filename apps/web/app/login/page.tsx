'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { LoginShowcasePanel } from '@/components/auth/login-showcase-panel';
import { LoginNoticeDialog } from '@/components/auth/login-notice-dialog';
import { LoginJoinedOffices } from '@/components/auth/login-joined-offices';
import {
  clearAccessToken,
  fetchMe,
  isLoginOtp,
  loginRequest,
  resendLoginOtp,
  setAccessToken,
  SET_PASSWORD_PATH,
  verifyLoginOtp,
  type LoginSessionData,
} from '@/lib/auth';
import { homePathFor } from '@/lib/salary-only';
import { WEB_REGISTRATION_OPEN } from '@/lib/registration';

/** Only same-site paths, so ?next= cannot redirect to another origin. */
function safeNextPath(): string | null {
  if (typeof window === 'undefined') return null;
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;
}

export default function LoginPage() {
  const router = useRouter();
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

  async function continueAfterSession(session: LoginSessionData) {
    setAccessToken(session.accessToken);
    if (session.must_change_password) {
      router.replace(SET_PASSWORD_PATH);
      return;
    }
    if (session.user.status === 'pending_verify') {
      router.replace('/register/verify');
      return;
    }
    const next = safeNextPath();
    if (next) {
      router.replace(next);
      return;
    }
    const me = await fetchMe().catch(() => null);
    router.replace(homePathFor(me?.data ?? null));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await loginRequest(email.trim(), password);
      if (isLoginOtp(res.data)) {
        setPassword('');
        setChallenge(res.data.challenge);
        setPhoneHint(res.data.phone_hint);
        setCode('');
        setResendIn(60);
        return;
      }
      await continueAfterSession(res.data);
    } catch (err) {
      clearAccessToken();
      setError(err instanceof Error ? err.message : 'Sign in failed. Try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await verifyLoginOtp(challenge, code.trim());
      await continueAfterSession(res.data);
    } catch (err) {
      clearAccessToken();
      setError(err instanceof Error ? err.message : 'That code is not correct.');
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    if (resendIn > 0 || loading) return;
    setLoading(true);
    setError('');
    try {
      const res = await resendLoginOtp(challenge);
      setChallenge(res.data.challenge);
      setPhoneHint(res.data.phone_hint);
      setResendIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a new code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <LoginNoticeDialog />
      <LoginShowcasePanel />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-background p-4 sm:p-8">
        <div className="w-full max-w-md rounded-xl bg-gradient-to-r from-[#0b3d2e] to-teal-700 px-4 py-3 text-white shadow-md lg:hidden">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-200">New · Pay Scale 2026</p>
          <p className="text-sm font-bold">Arrears bill &amp; T.R. Form 13, ready in minutes</p>
          <p className="text-xs text-emerald-50/80">Sign in to calculate month-by-month arrears and print T.R. Form 13.</p>
        </div>
        <LoginJoinedOffices />
        <Card className="w-full max-w-md border-0 shadow-lg sm:border">
          <CardHeader className="space-y-1 pb-2 text-center lg:text-left">
            <div className="mx-auto mb-3 lg:hidden">
              <Image
                src="/brand/proassist-logo.png"
                alt="ProAssist"
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl"
                priority
              />
            </div>
            <CardTitle className="text-2xl">{challenge ? 'Enter the code' : 'Sign in'}</CardTitle>
          </CardHeader>
          <CardContent>
            {challenge ? (
              <form onSubmit={handleOtp} className="space-y-5">
                <p className="text-sm text-muted">
                  A 6-digit code was sent to <span className="font-semibold text-foreground">{phoneHint}</span>. It expires
                  in 5 minutes.
                </p>
                <FormField label="Verification code" htmlFor="otp" required>
                  <Input
                    id="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="\d{6}"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="••••••"
                    className="text-center text-lg tracking-[0.4em]"
                    required
                    autoFocus
                  />
                </FormField>
                {error ? <Alert variant="error">{error}</Alert> : null}
                <Button type="submit" className="h-11 w-full text-base" disabled={loading || code.length !== 6}>
                  {loading ? 'Checking…' : 'Verify and sign in'}
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    className="text-muted hover:underline disabled:opacity-50"
                    disabled={loading}
                    onClick={() => {
                      setChallenge('');
                      setCode('');
                      setError('');
                    }}
                  >
                    Use a different account
                  </button>
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline disabled:opacity-50"
                    disabled={loading || resendIn > 0}
                    onClick={() => void handleResend()}
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </button>
                </div>
              </form>
            ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <FormField label="Mobile or email" htmlFor="email" required>
                <Input
                  id="email"
                  type="text"
                  inputMode="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="01XXXXXXXXX or email"
                  required
                  autoComplete="username"
                />
              </FormField>
              <FormField label="Password" htmlFor="password" required>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </FormField>
              <div className="flex justify-end">
                <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              {error ? <Alert variant="error">{error}</Alert> : null}
              <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
              {WEB_REGISTRATION_OPEN ? (
                <p className="text-center text-sm text-muted">
                  New user?{' '}
                  <Link href="/register" className="font-medium text-[#b71c1c] hover:underline">
                    Create Account
                  </Link>
                </p>
              ) : null}
            </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
