'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { LoginShowcasePanel } from '@/components/auth/login-showcase-panel';
import { registerRequest, setAccessToken } from '@/lib/auth';
import { WEB_REGISTRATION_OPEN } from '@/lib/registration';

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    if (!WEB_REGISTRATION_OPEN) router.replace('/login');
  }, [router]);

  return WEB_REGISTRATION_OPEN ? <RegisterForm /> : null;
}

function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    full_name_en: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    if (!acceptedTerms) {
      setError('অফিসের সকলের বা অন্তত ৫ জনের বিল ফরম ডাউনলোডের সম্মতি দিন');
      return;
    }
    setLoading(true);
    try {
      const res = await registerRequest({
        full_name_en: form.full_name_en.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        user_type: 'applicant',
        accept_terms: acceptedTerms,
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
      <LoginShowcasePanel />
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
              <FormField label="Email" htmlFor="email" required hint="Used to reset your password if you forget it">
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  placeholder="you@example.com"
                  required
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
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                />
                <span className="font-medium text-[#b71c1c]">
                  আমি আমার অফিসের সকলের বা অন্তত ৫ জনের বিল ফরম ডাউনলোড করতে চাই
                </span>
              </label>
              {error && <Alert variant="error">{error}</Alert>}
              <Button type="submit" className="h-11 w-full" disabled={loading || !acceptedTerms}>
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
