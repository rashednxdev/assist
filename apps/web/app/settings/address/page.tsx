'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { GeographyCascade } from '@/components/geography/geography-cascade';

interface AddressRow {
  id: string;
  address_type: string;
  village_or_area?: string;
  full_address?: string;
  is_primary: boolean;
}

export default function SettingsAddressPage() {
  const [addresses, setAddresses] = useState<AddressRow[]>([]);
  const [geo, setGeo] = useState({ divisionId: '', districtId: '', thanaId: '' });
  const [form, setForm] = useState({
    address_type: 'permanent' as 'permanent' | 'present' | 'office',
    village_or_area: '',
    post_code: '',
    full_address: '',
    is_primary: true,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  function reload() {
    apiFetch<{ data: AddressRow[] }>('/account/addresses').then((r) => setAddresses(r.data));
  }

  useEffect(() => {
    reload();
  }, []);

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!geo.divisionId || !geo.districtId || !geo.thanaId) {
      setError('Please select division, district, and thana');
      return;
    }
    setError('');
    try {
      await apiFetch('/account/addresses', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          division_id: geo.divisionId,
          district_id: geo.districtId,
          thana_id: geo.thanaId,
        }),
      });
      setMessage('Address saved');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save address');
    }
  }

  async function remove(id: string) {
    if (!confirm('Remove this address?')) return;
    await apiFetch(`/account/addresses/${id}`, { method: 'DELETE' });
    reload();
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Saved addresses</CardTitle>
        </CardHeader>
        <CardContent>
          {addresses.length === 0 ? (
            <p className="text-sm text-muted">No addresses yet. Add one below for exam correspondence.</p>
          ) : (
            <ul className="space-y-3">
              {addresses.map((a) => (
                <li
                  key={a.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm"
                >
                  <div>
                    <span className="font-medium capitalize">{a.address_type}</span>
                    {a.is_primary && <span className="ml-2 text-xs text-primary">Primary</span>}
                    <p className="mt-1 text-muted">{a.full_address || a.village_or_area || '—'}</p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => remove(a.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add address</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={addAddress} className="space-y-4">
            <FormField label="Address type" htmlFor="addr-type">
              <select
                id="addr-type"
                value={form.address_type}
                onChange={(e) =>
                  setForm((f) => ({ ...f, address_type: e.target.value as typeof f.address_type }))
                }
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="permanent">Permanent</option>
                <option value="present">Present</option>
                <option value="office">Office</option>
              </select>
            </FormField>
            <GeographyCascade
              divisionId={geo.divisionId}
              districtId={geo.districtId}
              thanaId={geo.thanaId}
              onDivisionChange={(id) => setGeo({ divisionId: id, districtId: '', thanaId: '' })}
              onDistrictChange={(id) => setGeo((g) => ({ ...g, districtId: id, thanaId: '' }))}
              onThanaChange={(id) => setGeo((g) => ({ ...g, thanaId: id }))}
            />
            <FormField label="Village / area" htmlFor="village">
              <Input
                id="village"
                value={form.village_or_area}
                onChange={(e) => setForm((f) => ({ ...f, village_or_area: e.target.value }))}
              />
            </FormField>
            <FormField label="Post code" htmlFor="post">
              <Input
                id="post"
                value={form.post_code}
                onChange={(e) => setForm((f) => ({ ...f, post_code: e.target.value }))}
              />
            </FormField>
            <FormField label="Full address" htmlFor="full">
              <Input
                id="full"
                value={form.full_address}
                onChange={(e) => setForm((f) => ({ ...f, full_address: e.target.value }))}
              />
            </FormField>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_primary}
                onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.checked }))}
              />
              Set as primary address
            </label>
            {message && <Alert variant="success">{message}</Alert>}
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit">Save address</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
