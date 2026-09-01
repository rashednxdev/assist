'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import {
  clearAccessToken,
  loginRequest,
  logoutRequest,
  setAccessToken,
} from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await loginRequest(email, password);
      const user = res.data.user;
      if (!isPlatformAdmin(user)) {
        setAccessToken(res.data.accessToken);
        try {
          await logoutRequest();
        } catch {
          clearAccessToken();
        }
        router.replace('/unavailable');
        return;
      }
      setAccessToken(res.data.accessToken);
      router.push('/dashboard');
    } catch {
      // Do not reveal whether credentials were valid — same destination as non-admin.
      clearAccessToken();
      router.replace('/unavailable');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 p-4">
      <Card className="w-full max-w-sm border border-neutral-200 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg font-medium text-neutral-800">Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormField label="Mobile" htmlFor="email" required>
              <Input
                id="email"
                type="tel"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="01XXXXXXXXX"
                required
                autoComplete="tel"
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
            <Button type="submit" className="h-10 w-full" disabled={loading}>
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
