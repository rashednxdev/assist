'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { LoginShowcasePanel } from '@/components/auth/login-showcase-panel';
import { LoginNoticeDialog } from '@/components/auth/login-notice-dialog';
import { clearAccessToken, fetchMe, loginRequest, setAccessToken, SET_PASSWORD_PATH } from '@/lib/auth';
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await loginRequest(email.trim(), password);
      const user = res.data.user;
      setAccessToken(res.data.accessToken);
      if (res.data.must_change_password) {
        router.replace(SET_PASSWORD_PATH);
        return;
      }
      if (user.status === 'pending_verify') {
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
    } catch (err) {
      clearAccessToken();
      setError(err instanceof Error ? err.message : 'Sign in failed. Try again.');
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
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>Use the same account as the ProAssist mobile app</CardDescription>
          </CardHeader>
          <CardContent>
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
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
              </FormField>
              {error ? <Alert variant="error">{error}</Alert> : null}
              <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
              {WEB_REGISTRATION_OPEN ? (
                <p className="text-center text-sm text-muted">
                  New user?{' '}
                  <Link href="/register" className="font-medium text-primary hover:underline">
                    Create free account
                  </Link>
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
