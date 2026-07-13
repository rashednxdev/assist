'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, HelpCircle, RotateCcw, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  confirmPermanentDelete,
  confirmBatchPermanentDelete,
  confirmBatchRestore,
} from '@/lib/confirm-action';
import { fetchMe } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface QuestionItem {
  id: string;
  question_type_code: string;
  question_type_name?: string;
  body_en: string;
  difficulty: string;
  marks: number;
  is_published: boolean;
  updated_at: string;
}

export default function QuestionsTrashPage() {
  const [items, setItems] = useState<QuestionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [q, setQ] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchBusy, setBatchBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  function load(search?: string) {
    setLoading(true);
    setErr('');
    const params = new URLSearchParams();
    if (search?.trim()) params.set('q', search.trim());
    const qs = params.toString();
    apiFetch<{ data: QuestionItem[] }>(`/questions/trashed${qs ? `?${qs}` : ''}`)
      .then((r) => {
        setItems(r.data);
        setSelectedIds([]);
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load trash'))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchMe()
      .then((res) => {
        const admin = isPlatformAdmin(res.data);
        setIsAdmin(admin);
        if (admin) load();
        else setLoading(false);
      })
      .catch(() => setLoading(false))
      .finally(() => setAuthReady(true));
  }, []);

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAll() {
    if (selectedIds.length === items.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  }

  async function restore(item: QuestionItem) {
    setBusyId(item.id);
    setErr('');
    setMsg('');
    try {
      await apiFetch(`/questions/${item.id}/restore`, { method: 'POST' });
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
      setMsg('Question restored to the bank');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Restore failed');
    } finally {
      setBusyId(null);
    }
  }

  async function permanentDelete(item: QuestionItem) {
    const label = item.body_en.slice(0, 60) + (item.body_en.length > 60 ? '…' : '');
    if (!confirmPermanentDelete(label)) return;
    setBusyId(item.id);
    setErr('');
    setMsg('');
    try {
      await apiFetch(`/questions/${item.id}/permanent`, { method: 'DELETE' });
      setItems((prev) => prev.filter((x) => x.id !== item.id));
      setSelectedIds((prev) => prev.filter((id) => id !== item.id));
      setMsg('Question permanently deleted');
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Permanent delete failed');
    } finally {
      setBusyId(null);
    }
  }

  async function batchRestore() {
    if (selectedIds.length === 0) return;
    if (!confirmBatchRestore(selectedIds.length)) return;
    setErr('');
    setMsg('');
    setBatchBusy(true);
    try {
      const res = await apiFetch<{ data: { restored: number; failed: number } }>(
        '/questions/batch-restore',
        {
          method: 'POST',
          body: JSON.stringify({ ids: selectedIds }),
        },
      );
      const { restored, failed } = res.data;
      setMsg(
        failed > 0
          ? `Restored ${restored}; ${failed} failed`
          : `Restored ${restored} question${restored === 1 ? '' : 's'}`,
      );
      if (failed > 0) setErr(`${failed} question(s) could not be restored`);
      load(q);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Batch restore failed');
    } finally {
      setBatchBusy(false);
    }
  }

  async function batchPermanentDelete() {
    if (selectedIds.length === 0) return;
    if (!confirmBatchPermanentDelete(selectedIds.length)) return;
    setErr('');
    setMsg('');
    setBatchBusy(true);
    try {
      const res = await apiFetch<{ data: { deleted: number; failed: number } }>(
        '/questions/batch-permanent-delete',
        {
          method: 'POST',
          body: JSON.stringify({ ids: selectedIds }),
        },
      );
      const { deleted, failed } = res.data;
      setMsg(
        failed > 0
          ? `Permanently deleted ${deleted}; ${failed} failed`
          : `Permanently deleted ${deleted} question${deleted === 1 ? '' : 's'}`,
      );
      if (failed > 0) setErr(`${failed} question(s) could not be deleted`);
      load(q);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Batch permanent delete failed');
    } finally {
      setBatchBusy(false);
    }
  }

  if (!authReady) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!isAdmin) {
    return <Alert variant="error">Only admins can manage the question trash.</Alert>;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question trash"
        description="Soft-deleted questions. Restore them or delete permanently with related documents."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/questions">
              <ArrowLeft className="h-4 w-4" />
              Back to bank
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg">Trashed questions</CardTitle>
          <form
            className="mt-3 flex flex-wrap gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              load(q);
            }}
          >
            <div className="min-w-[220px] flex-1 space-y-1.5">
              <Label htmlFor="trash-q">Search</Label>
              <Input id="trash-q" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="flex items-end">
              <Button type="submit" size="sm" variant="outline">
                <Search className="h-4 w-4" />
                Search
              </Button>
            </div>
          </form>
        </CardHeader>
        <CardContent className="p-4">
          {msg && <Alert variant="success" className="mb-4">{msg}</Alert>}
          {err && <Alert variant="error" className="mb-4">{err}</Alert>}
          {items.length > 0 && !loading && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2">
              <label className="flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input"
                  checked={selectedIds.length === items.length && items.length > 0}
                  onChange={toggleSelectAll}
                />
                Select all ({selectedIds.length}/{items.length})
              </label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={selectedIds.length === 0 || batchBusy}
                onClick={() => void batchRestore()}
              >
                <RotateCcw className="h-4 w-4" />
                Restore selected ({selectedIds.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                disabled={selectedIds.length === 0 || batchBusy}
                onClick={() => void batchPermanentDelete()}
              >
                <Trash2 className="h-4 w-4" />
                Delete forever ({selectedIds.length})
              </Button>
            </div>
          )}
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState title="Trash is empty" description="No soft-deleted questions." />
          ) : (
            <div className="space-y-3">
              {items.map((item) => {
                const busy = busyId === item.id || batchBusy;
                const selected = selectedIds.includes(item.id);
                return (
                  <div
                    key={item.id}
                    className={`flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center ${
                      selected
                        ? 'border-primary/50 bg-primary-muted/20'
                        : 'border-border bg-slate-50/50'
                    }`}
                  >
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <input
                        type="checkbox"
                        className="mt-3 h-4 w-4 shrink-0 rounded border-input"
                        checked={selected}
                        onChange={() => toggleSelect(item.id)}
                        aria-label={`Select question ${item.body_en.slice(0, 40)}`}
                      />
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
                        <HelpCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">{item.body_en}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline">
                            {item.question_type_name ?? item.question_type_code}
                          </Badge>
                          <Badge variant="secondary">{item.difficulty}</Badge>
                          <Badge variant="outline">{item.marks} marks</Badge>
                        </div>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void restore(item)}
                      >
                        <RotateCcw className="h-4 w-4" />
                        Restore
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        disabled={busy}
                        onClick={() => void permanentDelete(item)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete forever
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
