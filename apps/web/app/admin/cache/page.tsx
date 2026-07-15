'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface CacheMeta {
  key: string;
  built_at: string | null;
  item_count: number | null;
  bytes: number | null;
  in_memory: boolean;
  on_disk: boolean;
}

interface CacheStatusResponse {
  status: CacheMeta[];
  keys: string[];
}

interface RebuildResponse {
  rebuilt_at: string;
  duration_ms: number;
  results: Array<{ key: string; ok: boolean; count?: number; error?: string }>;
  status: CacheMeta[];
}

function formatBytes(n: number | null) {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ContentCachePage() {
  const [rows, setRows] = useState<CacheMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [rebuilding, setRebuilding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    const res = await apiFetch<{ data: CacheStatusResponse }>('/admin/cache/status');
    setRows(res.data.status);
  }, []);

  useEffect(() => {
    load()
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load cache status'))
      .finally(() => setLoading(false));
  }, [load]);

  async function rebuildAll() {
    setRebuilding(true);
    setMessage('');
    setError('');
    try {
      const res = await apiFetch<{ data: RebuildResponse }>('/admin/cache/rebuild', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setRows(res.data.status);
      const failed = res.data.results.filter((r) => !r.ok);
      if (failed.length) {
        setError(failed.map((f) => `${f.key}: ${f.error}`).join('; '));
      } else {
        setMessage(`Cache rebuilt in ${res.data.duration_ms}ms`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rebuild failed');
    } finally {
      setRebuilding(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Content cache"
        description="Shared learning data (books, questions, exams, papers, stats) stored on the API server as JSON — no user or login data. Rebuild after publishing content so apps read from cache instead of MongoDB."
      />

      {message ? <Alert variant="success">{message}</Alert> : null}
      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-border pb-4">
          <CardTitle className="text-lg">Cache status</CardTitle>
          <Button onClick={() => void rebuildAll()} disabled={rebuilding || loading}>
            {rebuilding ? 'Rebuilding…' : 'Rebuild cache from database'}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted">Loading…</p>
          ) : (
            <div className="divide-y divide-border">
              {rows.map((row) => (
                <div
                  key={row.key}
                  className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 text-sm"
                >
                  <div>
                    <div className="font-semibold">{row.key}</div>
                    <div className="text-xs text-muted">
                      Built: {row.built_at ? new Date(row.built_at).toLocaleString() : 'Never'}
                      {row.item_count != null ? ` · ${row.item_count} items` : ''}
                      {` · ${formatBytes(row.bytes)}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant={row.in_memory ? 'success' : 'secondary'}>
                      {row.in_memory ? 'In memory' : 'Not loaded'}
                    </Badge>
                    <Badge variant={row.on_disk ? 'success' : 'secondary'}>
                      {row.on_disk ? 'On disk' : 'No file'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
