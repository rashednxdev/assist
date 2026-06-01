'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ModuleRow {
  _id: string;
  code: string;
  name_en: string;
  name_bn?: string;
  description_en: string;
  color: string;
  sort_order: number;
}

export default function ModulesPage() {
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: ModuleRow[] }>('/setup/modules')
      .then((res) => setModules(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">System modules</h1>
        <p className="text-sm text-muted">iBAS++ functional modules</p>
      </div>

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
                  <div className="font-medium">{m.name_en}</div>
                  {m.name_bn && <div className="text-xs text-muted">{m.name_bn}</div>}
                  <div className="mt-1 text-xs text-muted">{m.code}</div>
                  <p className="mt-2 text-sm text-muted">{m.description_en}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
