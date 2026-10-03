'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2 } from 'lucide-react';
import { setNewPasswordSchema } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { clearAccessToken, fetchMe, getAccessToken, logoutRequest } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel';

export default function SetPasswordPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/login');
      return;
    }
    fetchMe()
      .then((res) => {
        if (!res.data.must_change_password) {
          router.replace('/dashboard');
          return;
        }
        setName(res.data.full_name_en);
        setReady(true);
      })
      .catch(() => {
        clearAccessToken();
        router.replace('/login');
      });
  }, [router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const parsed = setNewPasswordSchema.safeParse({ new_password: password, confirm_password: confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Check the password');
      return;
    }
    setBusy(true);
    try {
      await apiFetch('/account/set-new-password', { method: 'POST', body: JSON.stringify(parsed.data) });
      router.replace('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the password');
      setBusy(false);
    }
  }

  async function signOut() {
    await logoutRequest();
    router.replace('/login');
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AuthBrandPanel />
      <div className="flex flex-1 items-center justify-center bg-background p-4 sm:p-8">
        <Card className="w-full max-w-md border-0 shadow-lg sm:border">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="flex items-center gap-2 text-2xl">
              <KeyRound className="h-6 w-6 text-primary" />
              Set your new password
            </CardTitle>
            <CardDescription>
              {name ? `Welcome back, ${name}. ` : ''}You signed in with a temporary password from the admin. Choose your own
              password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!ready ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted" />
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <FormField label="New password" htmlFor="new-password">
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    autoFocus
                  />
                </FormField>
                <FormField label="Confirm new password" htmlFor="confirm-password">
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </FormField>
                {error && <Alert variant="error">{error}</Alert>}
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  Save and continue
                </Button>
                <button type="button" onClick={signOut} className="w-full text-center text-sm text-muted hover:underline">
                  Sign out
                </button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
