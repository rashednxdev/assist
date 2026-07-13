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
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel';
import { registerRequest, setAccessToken } from '@/lib/auth';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name_en: '',
    full_name_bn: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
    user_type: 'applicant' as 'applicant' | 'officer',
    accept_terms: false,
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!form.accept_terms) {
      setError('Please accept the terms to continue');
      return;
    }
    setLoading(true);
    try {
      const res = await registerRequest({
        ...form,
        accept_terms: true,
      });
      setAccessToken(res.data.tokens.accessToken);
      sessionStorage.setItem(
        'ibas_register_demo',
        JSON.stringify({
          email: form.email,
          phone: form.phone,
          emailOtp: res.data.demo.emailOtp,
          phoneOtp: res.data.demo.phoneOtp,
        }),
      );
      router.push('/register/verify');
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
            <CardDescription>
              Free self-registration for government service holders and exam candidates. Address can be added later in
              Settings.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <FormField label="Full name (English)" htmlFor="name-en" required>
                <Input
                  id="name-en"
                  value={form.full_name_en}
                  onChange={(e) => setForm((f) => ({ ...f, full_name_en: e.target.value }))}
                  required
                />
              </FormField>
              <FormField label="Full name (Bengali)" htmlFor="name-bn" hint="Optional">
                <Input
                  id="name-bn"
                  value={form.full_name_bn}
                  onChange={(e) => setForm((f) => ({ ...f, full_name_bn: e.target.value }))}
                />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Email" htmlFor="email" required>
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="Mobile" htmlFor="phone" required hint="01XXXXXXXXX">
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="01700000000"
                    required
                  />
                </FormField>
              </div>
              <FormField label="I am registering as" htmlFor="user-type" required>
                <select
                  id="user-type"
                  value={form.user_type}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, user_type: e.target.value as 'applicant' | 'officer' }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="applicant">Exam candidate (SAS / SRAS preparation)</option>
                  <option value="officer">Government officer (rules &amp; iBAS user)</option>
                </select>
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
                  />
                </FormField>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.accept_terms}
                  onChange={(e) => setForm((f) => ({ ...f, accept_terms: e.target.checked }))}
                  className="mt-1"
                />
                <span>I agree to the terms of use and privacy policy for ProAssist.</span>
              </label>
              {error && <Alert variant="error">{error}</Alert>}
              <Button type="submit" className="h-11 w-full" disabled={loading}>
                {loading ? 'Creating account…' : 'Continue to verification'}
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
