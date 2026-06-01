'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface Profile {
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone: string;
  nid?: string;
  employee_id?: string;
  user_type: string;
  email_verified: boolean;
  phone_verified: boolean;
}

export default function SettingsProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState({
    full_name_en: '',
    full_name_bn: '',
    phone: '',
    nid: '',
    employee_id: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: Profile }>('/account/profile').then((r) => {
      setProfile(r.data);
      setForm({
        full_name_en: r.data.full_name_en,
        full_name_bn: r.data.full_name_bn ?? '',
        phone: r.data.phone,
        nid: r.data.nid ?? '',
        employee_id: r.data.employee_id ?? '',
      });
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const r = await apiFetch<{ data: Profile }>('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name_en: form.full_name_en,
          full_name_bn: form.full_name_bn || undefined,
          phone: form.phone,
          nid: form.nid || undefined,
          employee_id: form.employee_id || undefined,
        }),
      });
      setProfile(r.data);
      setMessage('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  }

  if (!profile) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Profile</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="space-y-4">
          <div className="flex flex-wrap gap-2 text-sm">
            <Badge variant={profile.email_verified ? 'success' : 'warning'}>
              Email {profile.email_verified ? 'verified' : 'unverified'}
            </Badge>
            <Badge variant={profile.phone_verified ? 'success' : 'warning'}>
              Phone {profile.phone_verified ? 'verified' : 'unverified'}
            </Badge>
            <Badge variant="outline">{profile.user_type}</Badge>
          </div>
          <FormField label="Email" htmlFor="email">
            <Input id="email" value={profile.email} disabled />
          </FormField>
          <FormField label="Full name (English)" htmlFor="name-en" required>
            <Input
              id="name-en"
              value={form.full_name_en}
              onChange={(e) => setForm((f) => ({ ...f, full_name_en: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Full name (Bengali)" htmlFor="name-bn">
            <Input
              id="name-bn"
              value={form.full_name_bn}
              onChange={(e) => setForm((f) => ({ ...f, full_name_bn: e.target.value }))}
            />
          </FormField>
          <FormField label="Mobile" htmlFor="phone" required>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </FormField>
          <FormField label="NID" htmlFor="nid" hint="Optional — for exam eligibility">
            <Input id="nid" value={form.nid} onChange={(e) => setForm((f) => ({ ...f, nid: e.target.value }))} />
          </FormField>
          <FormField label="Employee ID" htmlFor="emp" hint="Optional — for iBAS / office users">
            <Input
              id="emp"
              value={form.employee_id}
              onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))}
            />
          </FormField>
          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit">Save profile</Button>
        </form>
      </CardContent>
    </Card>
  );
}
