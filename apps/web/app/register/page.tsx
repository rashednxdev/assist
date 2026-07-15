'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel';
import { registerRequest, setAccessToken } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name_en: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await registerRequest({
        full_name_en: form.full_name_en.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        user_type: 'applicant',
        accept_terms: true,
      });
      setAccessToken(res.data.tokens.accessToken);
      router.push('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AuthBrandPanel />
      <div className="flex flex-1 items-center justify-center bg-background p-4 sm:p-8">
        <Card className="w-full max-w-lg border-0 shadow-lg sm:border">
          <CardHeader className="space-y-1 pb-2">
            <div className="mb-2 lg:hidden">
              <Image
                src="/brand/proassist-logo.png"
                alt="ProAssist"
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl"
                priority
              />
            </div>
            <CardTitle className="text-2xl">Create your account</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Full name (English)" htmlFor="name-en" required>
                <Input
                  id="name-en"
                  value={form.full_name_en}
                  onChange={(e) => setForm((f) => ({ ...f, full_name_en: e.target.value }))}
                  required
                  minLength={2}
                />
              </FormField>
              <FormField label="Mobile" htmlFor="phone" required hint="01XXXXXXXXX">
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="01700000000"
                  required
                  pattern="01[3-9][0-9]{8}"
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Password" htmlFor="password" required>
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    required
                    minLength={8}
                  />
                </FormField>
                <FormField label="Confirm password" htmlFor="confirm" required>
                  <Input
                    id="confirm"
                    type="password"
                    value={form.confirm_password}
                    onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
                    required
                    minLength={8}
                  />
                </FormField>
              </div>
              {error && <Alert variant="error">{error}</Alert>}
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? 'Creating account…' : 'Create account'}
              </Button>
              <p className="text-center text-sm text-muted">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
