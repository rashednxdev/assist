'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';

export default function SettingsPasswordPage() {
  const [form, setForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      await apiFetch('/account/change-password', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setMessage('Password changed successfully');
      setForm({ current_password: '', new_password: '', confirm_password: '' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password');
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Change password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={save} className="max-w-md space-y-4">
          <FormField label="Current password" htmlFor="current" required>
            <Input
              id="current"
              type="password"
              value={form.current_password}
              onChange={(e) => setForm((f) => ({ ...f, current_password: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="New password" htmlFor="new" required hint="Minimum 8 characters">
            <Input
              id="new"
              type="password"
              value={form.new_password}
              onChange={(e) => setForm((f) => ({ ...f, new_password: e.target.value }))}
              required
              minLength={8}
            />
          </FormField>
          <FormField label="Confirm new password" htmlFor="confirm" required>
            <Input
              id="confirm"
              type="password"
              value={form.confirm_password}
              onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
              required
            />
          </FormField>
          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit">Update password</Button>
        </form>
      </CardContent>
    </Card>
  );
}
