'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { confirmDelete } from '@/lib/confirm-action';
import { RowActions } from '@/components/shared/row-actions';
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

type GeoKind = 'division' | 'district' | 'thana';

interface GeoEdit {
  kind: GeoKind;
  id: string;
  name_en: string;
  name_bn: string;
  short_code: string;
}

export default function GeographyAdminPage() {
  const [tree, setTree] = useState<DivisionNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [geoEdit, setGeoEdit] = useState<GeoEdit | null>(null);

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

  function startGeoEdit(kind: GeoKind, id: string, row: { name_en: string; name_bn?: string; short_code: string }) {
    setGeoEdit({
      kind,
      id,
      name_en: row.name_en,
      name_bn: row.name_bn ?? '',
      short_code: row.short_code,
    });
    setError('');
    setMessage('');
  }

  async function saveGeoEdit() {
    if (!geoEdit) return;
    const body = {
      name_en: geoEdit.name_en.trim(),
      name_bn: geoEdit.name_bn.trim() || undefined,
      short_code: geoEdit.short_code.trim(),
    };
    const paths: Record<GeoKind, string> = {
      division: `/setup/divisions/${geoEdit.id}`,
      district: `/setup/districts/${geoEdit.id}`,
      thana: `/setup/thanas/${geoEdit.id}`,
    };
    setBusy(true);
    setError('');
    try {
      await apiFetch(paths[geoEdit.kind], { method: 'PATCH', body: JSON.stringify(body) });
      setMessage('Updated');
      setGeoEdit(null);
      loadTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function removeGeo(kind: GeoKind, id: string, label: string) {
    if (!confirmDelete(label)) return;
    const paths: Record<GeoKind, string> = {
      division: `/setup/divisions/${id}`,
      district: `/setup/districts/${id}`,
      thana: `/setup/thanas/${id}`,
    };
    setBusy(true);
    setError('');
    try {
      await apiFetch(paths[kind], { method: 'DELETE' });
      setMessage('Removed');
      if (geoEdit?.id === id) setGeoEdit(null);
      loadTree();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    } finally {
      setBusy(false);
    }
  }

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
        <p className="text-sm text-muted">Divisions, districts, and thanas — add, edit, or remove</p>
      </div>

      {message && <p className="rounded-md bg-primary-light px-3 py-2 text-sm text-primary-dark">{message}</p>}
      {error && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {geoEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base capitalize">Edit {geoEdit.kind}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1">
                <Label>Name (English)</Label>
                <Input
                  value={geoEdit.name_en}
                  onChange={(e) => setGeoEdit({ ...geoEdit, name_en: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Name (Bengali)</Label>
                <Input
                  value={geoEdit.name_bn}
                  onChange={(e) => setGeoEdit({ ...geoEdit, name_bn: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Short code</Label>
                <Input
                  value={geoEdit.short_code}
                  onChange={(e) => setGeoEdit({ ...geoEdit, short_code: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={busy} onClick={saveGeoEdit}>
                Save changes
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setGeoEdit(null)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

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
                  className="ibas-select"
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
                  className="ibas-select"
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
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">
                        {div.name_en} ({div.short_code})
                      </span>
                      {div.name_bn && <span className="ml-2 text-muted">{div.name_bn}</span>}
                    </div>
                    <RowActions
                      onEdit={() => startGeoEdit('division', div._id, div)}
                      onDelete={() => removeGeo('division', div._id, div.name_en)}
                      busy={busy}
                    />
                  </div>
                  <ul className="ml-4 mt-1 space-y-2 border-l border-border pl-3">
                    {div.districts.map((dist) => (
                      <li key={dist._id}>
                        <div className="flex items-center justify-between gap-2">
                          <span>
                            {dist.name_en} ({dist.short_code})
                          </span>
                          <RowActions
                            onEdit={() => startGeoEdit('district', dist._id, dist)}
                            onDelete={() => removeGeo('district', dist._id, dist.name_en)}
                            busy={busy}
                          />
                        </div>
                        <ul className="ml-3 mt-1 space-y-1 text-muted">
                          {dist.thanas.map((t) => (
                            <li key={t._id} className="flex items-center justify-between gap-2 text-foreground">
                              <span>
                                {t.name_en} ({t.short_code})
                              </span>
                              <RowActions
                                onEdit={() => startGeoEdit('thana', t._id, t)}
                                onDelete={() => removeGeo('thana', t._id, t.name_en)}
                                busy={busy}
                              />
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
