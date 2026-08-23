'use client';

import { useEffect, useState } from 'react';
import type { AppSettingsRecord } from '@ibas/shared-types';
import { DEFAULT_UNPAID_MESSAGE } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

export default function UnpaidMessageAdminPage() {
  const [message, setMessage] = useState(DEFAULT_UNPAID_MESSAGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ data: AppSettingsRecord }>('/app-settings');
      setMessage(res.data.unpaid_message || DEFAULT_UNPAID_MESSAGE);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const res = await apiFetch<{ data: AppSettingsRecord }>('/app-settings', {
        method: 'PUT',
        body: JSON.stringify({ unpaid_message: message.trim() }),
      });
      setMessage(res.data.unpaid_message);
      setStatus('Unpaid access message saved. It will show on the mobile app for unpaid users.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Unpaid access message"
        description="Universal message shown to unpaid users on the mobile app when they need to pay for full access."
      />

      {status ? <Alert variant="success">{status}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      {loading ? (
        <p className="text-sm text-muted">Loading...</p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Message</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="unpaid-message">Shown to unpaid users</Label>
              <textarea
                id="unpaid-message"
                className="ibas-textarea min-h-[140px]"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={DEFAULT_UNPAID_MESSAGE}
                maxLength={2000}
              />
              <p className="text-xs text-muted">{message.trim().length}/2000</p>
            </div>
            <Button type="button" onClick={() => void save()} disabled={saving || !message.trim()}>
              {saving ? 'Saving…' : 'Save message'}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
