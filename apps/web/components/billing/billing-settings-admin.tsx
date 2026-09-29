'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BILLING_CHARGE_TYPES,
  computeCharge,
  formatBdt,
  roundTaka,
  type BillingChargeType,
  type BillingSettingsRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const SELECT = 'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm';

const CHARGE_TYPE_LABELS: Record<BillingChargeType, string> = {
  none: 'No charge',
  percent: 'Percentage of the price',
  fixed: 'Fixed amount per payment',
};

export function BillingSettingsAdmin() {
  const [s, setS] = useState<BillingSettingsRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    apiFetch<{ data: BillingSettingsRecord }>('/billing/admin/settings')
      .then((r) => setS(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load settings'));
  }, []);

  async function save() {
    if (!s) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const r = await apiFetch<{ data: BillingSettingsRecord }>('/billing/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(s),
      });
      setS(r.data);
      setMessage('Saved. New checkouts use these settings.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  if (!s) return error ? <Alert variant="error">{error}</Alert> : <Skeleton className="h-64 w-full" />;

  const examples = [500, 1000, 2500];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Payment settings</CardTitle>
        <p className="text-sm text-muted">The charge is added on top of the package price at checkout and shown to the user before paying.</p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="bs-type">Charge type</Label>
            <select
              id="bs-type"
              className={SELECT}
              value={s.charge_type}
              onChange={(e) => setS({ ...s, charge_type: e.target.value as BillingChargeType })}
            >
              {BILLING_CHARGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {CHARGE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {s.charge_type !== 'none' && (
            <div className="space-y-1.5">
              <Label htmlFor="bs-value">{s.charge_type === 'percent' ? 'Charge (%)' : 'Charge (৳)'}</Label>
              <Input
                id="bs-value"
                type="number"
                min={0}
                step="0.01"
                value={s.charge_value}
                onChange={(e) => setS({ ...s, charge_value: Number(e.target.value) })}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="bs-label">Charge label</Label>
            <Input id="bs-label" value={s.charge_label} onChange={(e) => setS({ ...s, charge_label: e.target.value })} />
          </div>
        </div>

        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <p className="mb-1 font-medium">Preview</p>
          {examples.map((price) => {
            const charge = computeCharge(price, s);
            return (
              <p key={price} className="text-muted">
                {formatBdt(price)} + {formatBdt(charge)} {s.charge_label.toLowerCase()} ={' '}
                <span className="font-semibold text-foreground">{formatBdt(roundTaka(price + charge))}</span>
              </p>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bs-note">Checkout note (optional)</Label>
          <textarea
            id="bs-note"
            rows={2}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={s.checkout_note ?? ''}
            onChange={(e) => setS({ ...s, checkout_note: e.target.value })}
            placeholder="e.g. Access is non-refundable once opened."
          />
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={s.gateway_enabled}
            onChange={(e) => setS({ ...s, gateway_enabled: e.target.checked })}
          />
          <span>
            Online payments enabled
            <span className="block text-xs text-muted">When off, users can browse packages but not pay; free packages and manual grants still work.</span>
          </span>
        </label>

        {error && <Alert variant="error">{error}</Alert>}
        {message && <Alert variant="success">{message}</Alert>}
        <Button onClick={save} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          Save settings
        </Button>
      </CardContent>
    </Card>
  );
}
