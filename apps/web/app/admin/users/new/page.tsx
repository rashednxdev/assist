'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { USER_TYPES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';

export default function NewUserPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name_en: '',
    full_name_bn: '',
    email: '',
    phone: '',
    password: '',
    user_type: 'officer' as (typeof USER_TYPES)[number],
  });

  function update(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/users', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          full_name_bn: form.full_name_bn || undefined,
        }),
      });
      router.push('/admin/users');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="Add user"
        description="Create a new account with English name and optional Bengali name."
        backHref="/admin/users"
        backLabel="Users"
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">User details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <FormField label="Full name (English)" htmlFor="full_name_en" required>
              <Input
                id="full_name_en"
                value={form.full_name_en}
                onChange={(e) => update('full_name_en', e.target.value)}
                required
              />
            </FormField>
            <FormField label="Full name (Bengali)" htmlFor="full_name_bn" hint="Optional">
              <Input
                id="full_name_bn"
                value={form.full_name_bn}
                onChange={(e) => update('full_name_bn', e.target.value)}
              />
            </FormField>
            <div className="grid gap-5 sm:grid-cols-2">
              <FormField label="Email" htmlFor="email" required>
                <Input
                  id="email"
                  type="email"
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  required
                />
              </FormField>
              <FormField label="Phone" htmlFor="phone" required>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => update('phone', e.target.value)}
                  required
                />
              </FormField>
            </div>
            <FormField label="Password" htmlFor="password" required hint="Minimum 8 characters">
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) => update('password', e.target.value)}
                minLength={8}
                required
              />
            </FormField>
            <FormField label="User type" htmlFor="user_type" required>
              <select
                id="user_type"
                className="ibas-select"
                value={form.user_type}
                onChange={(e) => update('user_type', e.target.value)}
              >
                {USER_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => router.push('/admin/users')}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Saving...' : 'Create user'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
