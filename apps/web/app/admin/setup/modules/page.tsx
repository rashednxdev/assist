'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ModuleRow {
  _id: string;
  code: string;
  name_en: string;
  name_bn?: string;
  description_en: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  stopped_reason?: string;
}

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [draftReason, setDraftReason] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    return apiFetch<{ data: ModuleRow[] }>('/setup/modules?all=true')
      .then((res) => setModules(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    void load();
  }, []);

  async function setActive(mod: ModuleRow, is_active: boolean) {
    setSavingId(mod._id);
    setError('');
    try {
      await apiFetch(`/setup/modules/${mod._id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          is_active,
          stopped_reason: is_active ? undefined : (draftReason[mod._id] ?? mod.stopped_reason ?? ''),
        }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update module');
    } finally {
      setSavingId(null);
    }
  }

  async function saveReason(mod: ModuleRow) {
    setSavingId(mod._id);
    setError('');
    try {
      await apiFetch(`/setup/modules/${mod._id}`, {
        method: 'PATCH',
        body: JSON.stringify({ stopped_reason: draftReason[mod._id] ?? '' }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save reason');
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">System modules</h1>
        <p className="text-sm text-muted">
          iBAS++ functional modules. Stopping a module blocks it for every user immediately,
          except users you mark &ldquo;Allow while module stopped&rdquo; on their Access tab
          (and admins, who always retain access). Use this for outages or maintenance;
          grant normal access on each user&apos;s Access tab.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Modules</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {modules.map((m) => (
                <div
                  key={m._id}
                  className="rounded-lg border border-border bg-white p-4"
                  style={{ borderLeftColor: m.color, borderLeftWidth: 4 }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{m.name_en}</div>
                      {m.name_bn && <div className="text-xs text-muted">{m.name_bn}</div>}
                      <div className="mt-1 text-xs text-muted">{m.code}</div>
                    </div>
                    <label className="flex shrink-0 items-center gap-1.5 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={m.is_active}
                        disabled={savingId === m._id}
                        onChange={(e) => void setActive(m, e.target.checked)}
                      />
                      {m.is_active ? 'Accessible' : 'Stopped'}
                    </label>
                  </div>
                  <p className="mt-2 text-sm text-muted">{m.description_en}</p>

                  {!m.is_active && (
                    <div className="mt-3 space-y-2 rounded-md bg-red-50 p-3">
                      <label className="block text-xs font-medium text-red-800">
                        Reason shown to students
                      </label>
                      <Input
                        value={draftReason[m._id] ?? m.stopped_reason ?? ''}
                        placeholder="e.g. Under maintenance, back soon"
                        maxLength={500}
                        onChange={(e) =>
                          setDraftReason((prev) => ({ ...prev, [m._id]: e.target.value }))
                        }
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={savingId === m._id}
                        onClick={() => void saveReason(m)}
                      >
                        Save reason
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
