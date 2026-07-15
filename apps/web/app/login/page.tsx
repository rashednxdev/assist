'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel';
import { loginRequest, setAccessToken } from '@/lib/auth';

export default function LoginPage() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await loginRequest(email, password);
      setAccessToken(res.data.accessToken);
      if (res.data.user.status === 'pending_verify' || !res.data.user.is_verified) {
        router.push('/register/verify');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t('loginFailed'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AuthBrandPanel />
      <div className="flex flex-1 items-center justify-center bg-background p-4 sm:p-8">
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
            <CardTitle className="text-2xl">{t('login')}</CardTitle>
            <CardDescription>Sign in to your ProAssist account</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              <FormField label="Mobile" htmlFor="email" required hint="01XXXXXXXXX">
                <Input
                  id="email"
                  type="tel"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="01700000000"
                  required
                  autoComplete="tel"
                />
              </FormField>
              <FormField label={t('password')} htmlFor="password" required>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('passwordPlaceholder')}
                  required
                  autoComplete="current-password"
                />
              </FormField>
              {error && <Alert variant="error">{error}</Alert>}
              <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
                {loading ? t('submitting') : t('submit')}
              </Button>
              <p className="text-center text-sm text-muted">
                New user?{' '}
                <Link href="/register" className="font-medium text-primary hover:underline">
                  Create free account
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
