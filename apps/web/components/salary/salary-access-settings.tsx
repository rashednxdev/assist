'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type {
  SalaryBulkSizeRecord,
  SalaryContactNumber,
  SalaryContactsRecord,
  SalaryFreeTrFormSettingsRecord,
  SalaryOfficeSettingsRecord,
} from '@ibas/shared-types';
import { SALARY_DEFAULT_BULK_SIZE, SALARY_FREE_TR_NID, SALARY_MAX_FREE_TR_COUNT } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

function formatWhen(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

function BulkSizeEditor() {
  const [bulkSize, setBulkSize] = useState(SALARY_DEFAULT_BULK_SIZE);
  const [value, setValue] = useState(String(SALARY_DEFAULT_BULK_SIZE));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: SalaryBulkSizeRecord }>('/salary/admin/bulk-size')
      .then((res) => {
        setBulkSize(res.data.bulk_size);
        setValue(String(res.data.bulk_size));
      })
      .catch(() => undefined);
  }, []);

  async function save() {
    const size = Number(value);
    if (!Number.isInteger(size) || size < 1 || size > 1000) {
      setError('Enter a whole number of bills from 1 to 1000.');
      return;
    }
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const res = await apiFetch<{ data: SalaryBulkSizeRecord }>('/salary/admin/bulk-size', {
        method: 'PUT',
        body: JSON.stringify({ bulk_size: size }),
      });
      setBulkSize(res.data.bulk_size);
      setValue(String(res.data.bulk_size));
      setStatus(`Saved. Users now request bills in bulks of ${res.data.bulk_size}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bill bulk size</CardTitle>
        <CardDescription>
          Users request one or more bulks. A request for 2 bulks asks for {plural(bulkSize * 2, 'bill')}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status ? <Alert variant="success">{status}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-40 space-y-1">
            <Label htmlFor="bulk-size" className="text-xs">
              Bills per bulk
            </Label>
            <Input
              id="bulk-size"
              type="number"
              min={1}
              max={1000}
              inputMode="numeric"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save bulk size'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function OfficeSettingsEditor() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: SalaryOfficeSettingsRecord }>('/salary/office/settings')
      .then((res) => setAllowed(res.data.others_allowed))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  async function save(next: boolean) {
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const res = await apiFetch<{ data: SalaryOfficeSettingsRecord }>('/salary/admin/office-settings', {
        method: 'PUT',
        body: JSON.stringify({ others_allowed: next }),
      });
      setAllowed(res.data.others_allowed);
      setStatus(
        res.data.others_allowed
          ? 'Others is shown. Users can type an office name that is not in the list.'
          : 'Others is hidden. Users must pick a listed office.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Office choice on the salary page</CardTitle>
        <CardDescription>
          Show or hide &quot;My office is not in the list (Others)&quot; on the office screen. Users who already chose
          Others keep their office.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status ? <Alert variant="success">{status}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {allowed === null ? (
          error ? null : <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-medium">Others option:</span>
              {allowed ? <Badge variant="success">Shown</Badge> : <Badge variant="secondary">Hidden</Badge>}
            </div>
            <Button type="button" variant={allowed ? 'outline' : 'default'} disabled={saving} onClick={() => void save(!allowed)}>
              {saving ? 'Saving…' : allowed ? 'Hide Others' : 'Show Others'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FreeTrFormEditor() {
  const [settings, setSettings] = useState<SalaryFreeTrFormSettingsRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [count, setCount] = useState('');

  useEffect(() => {
    apiFetch<{ data: SalaryFreeTrFormSettingsRecord }>('/salary/admin/free-tr-form')
      .then((res) => {
        setSettings(res.data);
        setCount(String(res.data.free_count));
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'));
  }, []);

  async function save(next: boolean) {
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const res = await apiFetch<{ data: SalaryFreeTrFormSettingsRecord }>('/salary/admin/free-tr-form', {
        method: 'PUT',
        body: JSON.stringify({ enabled: next }),
      });
      setSettings(res.data);
      setStatus(
        res.data.enabled
          ? `Allowed. Every user gets ${plural(res.data.free_count, 'free single T.R. Form download')}.`
          : 'Disabled. Only users who registered while it was allowed keep their free downloads.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function saveCount() {
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > SALARY_MAX_FREE_TR_COUNT) {
      setError(`Enter a whole number of downloads from 1 to ${SALARY_MAX_FREE_TR_COUNT}.`);
      return;
    }
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const res = await apiFetch<{ data: SalaryFreeTrFormSettingsRecord }>('/salary/admin/free-tr-form', {
        method: 'PUT',
        body: JSON.stringify({ free_count: n }),
      });
      setSettings(res.data);
      setCount(String(res.data.free_count));
      setStatus(`Saved. Each eligible user gets ${plural(res.data.free_count, 'free single T.R. Form download')}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Free single T.R. Form downloads</CardTitle>
        <CardDescription>
          While allowed, every user gets the set number of free T.R. Form 13 or 15 downloads for a single arrear bill. A
          free download is used only when the user has no approved bill left, and prints the NID as {SALARY_FREE_TR_NID}.
          When disabled, only users who registered while it was allowed keep theirs. The office staff bill is not
          included.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status ? <Alert variant="success">{status}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {settings === null ? (
          error ? null : <p className="text-sm text-muted">Loading…</p>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">Free downloads:</span>
              {settings.enabled ? (
                <Badge variant="success">Allowed</Badge>
              ) : (
                <Badge variant="secondary">Disabled</Badge>
              )}
              {settings.enabled && settings.enabled_since ? (
                <span className="text-xs text-muted">since {formatWhen(settings.enabled_since)}</span>
              ) : null}
            </div>
            <Button
              type="button"
              variant={settings.enabled ? 'outline' : 'default'}
              disabled={saving}
              onClick={() => void save(!settings.enabled)}
            >
              {saving ? 'Saving…' : settings.enabled ? 'Disable' : 'Allow'}
            </Button>
          </div>
        )}
        {settings === null ? null : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="w-48 space-y-1">
              <Label htmlFor="free-tr-count" className="text-xs">
                Free downloads per user
              </Label>
              <Input
                id="free-tr-count"
                type="number"
                min={1}
                max={SALARY_MAX_FREE_TR_COUNT}
                inputMode="numeric"
                value={count}
                onChange={(e) => setCount(e.target.value)}
              />
            </div>
            <Button type="button" onClick={() => void saveCount()} disabled={saving}>
              {saving ? 'Saving…' : 'Save free downloads'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContactsEditor() {
  const [contacts, setContacts] = useState<SalaryContactNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: SalaryContactsRecord }>('/salary/admin/contacts')
      .then((res) => setContacts(res.data.contacts))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load contacts'))
      .finally(() => setLoading(false));
  }, []);

  function update(index: number, patch: Partial<SalaryContactNumber>) {
    setContacts((list) => list.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  }

  async function save() {
    setSaving(true);
    setStatus('');
    setError('');
    try {
      const cleaned = contacts
        .map((c) => ({ label: c.label.trim(), number: c.number.trim(), whatsapp: c.whatsapp }))
        .filter((c) => c.number);
      const res = await apiFetch<{ data: SalaryContactsRecord }>('/salary/admin/contacts', {
        method: 'PUT',
        body: JSON.stringify({ contacts: cleaned }),
      });
      setContacts(res.data.contacts);
      setStatus('Contact numbers saved. Users see them on /salary when they need approval.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contact numbers</CardTitle>
        <CardDescription>Shown on the salary page so users can reach you for bill approval.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {status ? <Alert variant="success">{status}</Alert> : null}
        {error ? <Alert variant="error">{error}</Alert> : null}
        {loading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : (
          <>
            {contacts.length === 0 ? <p className="text-sm text-muted">No contact numbers yet.</p> : null}
            {contacts.map((c, i) => (
              <div key={i} className="grid items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                <div className="space-y-1">
                  <Label htmlFor={`contact-label-${i}`} className="text-xs">
                    Label (optional)
                  </Label>
                  <Input
                    id={`contact-label-${i}`}
                    value={c.label}
                    maxLength={80}
                    placeholder="e.g. Accounts Section"
                    onChange={(e) => update(i, { label: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor={`contact-number-${i}`} className="text-xs">
                    Number
                  </Label>
                  <Input
                    id={`contact-number-${i}`}
                    value={c.number}
                    maxLength={30}
                    inputMode="tel"
                    placeholder="01XXXXXXXXX"
                    onChange={(e) => update(i, { number: e.target.value })}
                  />
                </div>
                <label className="flex h-10 items-center gap-2 text-sm">
                  <input type="checkbox" checked={c.whatsapp} onChange={(e) => update(i, { whatsapp: e.target.checked })} />
                  WhatsApp
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Remove number"
                  onClick={() => setContacts((list) => list.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setContacts((list) => [...list, { label: '', number: '', whatsapp: true }])}
                disabled={contacts.length >= 20}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Add number
              </Button>
              <Button type="button" onClick={() => void save()} disabled={saving}>
                {saving ? 'Saving…' : 'Save contact numbers'}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function SalaryAccessSettings() {
  return (
    <div className="space-y-6">
      <BulkSizeEditor />
      <OfficeSettingsEditor />
      <FreeTrFormEditor />
      <ContactsEditor />
    </div>
  );
}
