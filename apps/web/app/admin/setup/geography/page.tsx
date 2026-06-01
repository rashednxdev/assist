'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DivisionNode {
  _id: string;
  name_en: string;
  name_bn?: string;
  short_code: string;
  districts: Array<{
    _id: string;
    name_en: string;
    name_bn?: string;
    short_code: string;
    thanas: Array<{ _id: string; name_en: string; name_bn?: string; short_code: string }>;
  }>;
}

export default function GeographyAdminPage() {
  const [tree, setTree] = useState<DivisionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [divForm, setDivForm] = useState({ name_en: '', name_bn: '', short_code: '' });
  const [distForm, setDistForm] = useState({ divisionId: '', name_en: '', name_bn: '', short_code: '' });
  const [thanaForm, setThanaForm] = useState({ districtId: '', name_en: '', name_bn: '', short_code: '' });

  function loadTree() {
    setLoading(true);
    apiFetch<{ data: DivisionNode[] }>('/setup/geography/tree')
      .then((r) => setTree(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTree();
  }, []);

  async function addDivision(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await apiFetch('/setup/divisions', {
        method: 'POST',
        body: JSON.stringify({ ...divForm, name_bn: divForm.name_bn || undefined }),
      });
      setDivForm({ name_en: '', name_bn: '', short_code: '' });
      setMessage('Division created');
      loadTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function addDistrict(e: React.FormEvent) {
    e.preventDefault();
    if (!distForm.divisionId) return;
    try {
      await apiFetch(`/setup/divisions/${distForm.divisionId}/districts`, {
        method: 'POST',
        body: JSON.stringify({
          name_en: distForm.name_en,
          name_bn: distForm.name_bn || undefined,
          short_code: distForm.short_code,
        }),
      });
      setDistForm({ divisionId: '', name_en: '', name_bn: '', short_code: '' });
      setMessage('District created');
      loadTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  async function addThana(e: React.FormEvent) {
    e.preventDefault();
    if (!thanaForm.districtId) return;
    try {
      await apiFetch(`/setup/districts/${thanaForm.districtId}/thanas`, {
        method: 'POST',
        body: JSON.stringify({
          name_en: thanaForm.name_en,
          name_bn: thanaForm.name_bn || undefined,
          short_code: thanaForm.short_code,
        }),
      });
      setThanaForm({ districtId: '', name_en: '', name_bn: '', short_code: '' });
      setMessage('Thana created');
      loadTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Geography</h1>
        <p className="text-sm text-muted">Divisions, districts, and thanas</p>
      </div>

      {message && <p className="rounded-md bg-primary-light px-3 py-2 text-sm text-primary-dark">{message}</p>}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Add division</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addDivision} className="space-y-3">
              <div className="space-y-1">
                <Label>Name (English)</Label>
                <Input value={divForm.name_en} onChange={(e) => setDivForm({ ...divForm, name_en: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Name (Bengali)</Label>
                <Input value={divForm.name_bn} onChange={(e) => setDivForm({ ...divForm, name_bn: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Short code</Label>
                <Input value={divForm.short_code} onChange={(e) => setDivForm({ ...divForm, short_code: e.target.value })} required />
              </div>
              <Button type="submit" size="sm">
                Add division
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add district</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addDistrict} className="space-y-3">
              <div className="space-y-1">
                <Label>Division</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={distForm.divisionId}
                  onChange={(e) => setDistForm({ ...distForm, divisionId: e.target.value })}
                  required
                >
                  <option value="">Select</option>
                  {tree.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name_en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Name (English)</Label>
                <Input value={distForm.name_en} onChange={(e) => setDistForm({ ...distForm, name_en: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Name (Bengali)</Label>
                <Input value={distForm.name_bn} onChange={(e) => setDistForm({ ...distForm, name_bn: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Short code</Label>
                <Input value={distForm.short_code} onChange={(e) => setDistForm({ ...distForm, short_code: e.target.value })} required />
              </div>
              <Button type="submit" size="sm">
                Add district
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add thana</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={addThana} className="space-y-3">
              <div className="space-y-1">
                <Label>District</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-border bg-white px-3 text-sm"
                  value={thanaForm.districtId}
                  onChange={(e) => setThanaForm({ ...thanaForm, districtId: e.target.value })}
                  required
                >
                  <option value="">Select</option>
                  {tree.flatMap((d) =>
                    d.districts.map((dist) => (
                      <option key={dist._id} value={dist._id}>
                        {d.name_en} → {dist.name_en}
                      </option>
                    )),
                  )}
                </select>
              </div>
              <div className="space-y-1">
                <Label>Name (English)</Label>
                <Input value={thanaForm.name_en} onChange={(e) => setThanaForm({ ...thanaForm, name_en: e.target.value })} required />
              </div>
              <div className="space-y-1">
                <Label>Name (Bengali)</Label>
                <Input value={thanaForm.name_bn} onChange={(e) => setThanaForm({ ...thanaForm, name_bn: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Short code</Label>
                <Input value={thanaForm.short_code} onChange={(e) => setThanaForm({ ...thanaForm, short_code: e.target.value })} required />
              </div>
              <Button type="submit" size="sm">
                Add thana
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Geography tree</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <div className="space-y-4 text-sm">
              {tree.map((div) => (
                <div key={div._id}>
                  <div className="font-medium">
                    {div.name_en} ({div.short_code})
                    {div.name_bn && <span className="ml-2 text-muted">{div.name_bn}</span>}
                  </div>
                  <ul className="ml-4 mt-1 space-y-2 border-l border-border pl-3">
                    {div.districts.map((dist) => (
                      <li key={dist._id}>
                        <div>{dist.name_en} ({dist.short_code})</div>
                        <ul className="ml-3 mt-1 space-y-1 text-muted">
                          {dist.thanas.map((t) => (
                            <li key={t._id}>
                              {t.name_en} ({t.short_code})
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
