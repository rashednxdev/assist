'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, History, Pencil, Trash2 } from 'lucide-react';
import { confirmDelete } from '@/lib/confirm-action';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RichTextView } from '@/components/books/rich-text-view';

interface Amendment {
  id: string;
  amendment_no: string;
  amendment_date: string;
  issued_by: string;
  circular_ref?: string;
  old_text?: string;
  new_text: string;
  change_summary: string;
}

interface RegulationDetail {
  id: string;
  regulation_no: string;
  title: string;
  full_text: string;
  regulation_type: string;
  effective_date: string;
  is_amended: boolean;
  applicable_to: string[];
  payment_related: boolean;
  receipt_related: boolean;
  book_name?: string;
  book_short_name?: string;
  amendments: Amendment[];
}

export default function RegulationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [reg, setReg] = useState<RegulationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [editForm, setEditForm] = useState({ title: '', full_text: '' });

  function load() {
    return apiFetch<{ data: RegulationDetail }>(`/books/regulations/${id}`).then((r) => {
      setReg(r.data);
      setEditForm({
        title: r.data.title,
        full_text: r.data.full_text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
      });
    });
  }

  useEffect(() => {
    if (!id) return;
    load().finally(() => setLoading(false));
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (!reg) {
    return <p className="text-muted">Regulation not found.</p>;
  }

  async function removeRegulation() {
    if (!reg || !confirmDelete(reg.title)) return;
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/books/regulations/${id}`, { method: 'DELETE' });
      router.push('/books/regulations');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setBusy(false);
    }
  }

  async function saveEdit() {
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const text = editForm.full_text.trim();
      await apiFetch(`/books/regulations/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: editForm.title.trim(),
          full_text: text.startsWith('<') ? text : `<p>${text}</p>`,
        }),
      });
      setMessage('Regulation updated');
      setEditing(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/books/regulations">
            <ArrowLeft className="h-4 w-4" />
            Back to search
          </Link>
        </Button>
        {isAdmin && (
          <>
            <Button size="sm" variant={editing ? 'default' : 'outline'} onClick={() => setEditing(!editing)}>
              <Pencil className="h-4 w-4" />
              {editing ? 'Cancel edit' : 'Edit'}
            </Button>
            <Button size="sm" variant="outline" className="text-red-600" disabled={busy} onClick={removeRegulation}>
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </>
        )}
      </div>

      <PageHeader
        title={`${reg.regulation_no} — ${reg.title}`}
        description={reg.book_name ? `${reg.book_short_name} · ${reg.book_name}` : undefined}
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{reg.regulation_type}</Badge>
        {reg.is_amended && <Badge variant="warning">Amended</Badge>}
        {reg.payment_related && <Badge variant="secondary">Payment related</Badge>}
        {reg.receipt_related && <Badge variant="secondary">Receipt related</Badge>}
        {reg.applicable_to.map((a) => (
          <Badge key={a} variant="outline">
            {a}
          </Badge>
        ))}
      </div>

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg">Current text</CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          {editing ? (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Title</Label>
                <Input disabled={busy} value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Full text</Label>
                <textarea className="ibas-textarea min-h-[120px]" disabled={busy} value={editForm.full_text} onChange={(e) => setEditForm({ ...editForm, full_text: e.target.value })} />
              </div>
              <Button size="sm" disabled={busy} onClick={saveEdit}>Save changes</Button>
            </div>
          ) : (
            <>
              <RichTextView html={reg.full_text} />
              <p className="mt-4 text-xs text-muted">
                Effective from {new Date(reg.effective_date).toLocaleDateString()}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {reg.amendments.length > 0 && (
        <Card>
          <CardHeader className="border-b border-border pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="h-5 w-5 text-primary" />
              Amendment history
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4">
            {reg.amendments.map((a) => (
              <div key={a.id} className="rounded-xl border border-border bg-slate-50/80 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{a.amendment_no}</span>
                  <span className="text-xs text-muted">{new Date(a.amendment_date).toLocaleDateString()}</span>
                  <Badge variant="outline">{a.issued_by}</Badge>
                  {a.circular_ref && <Badge variant="secondary">{a.circular_ref}</Badge>}
                </div>
                <p className="mt-2 text-sm font-medium">{a.change_summary}</p>
                {a.old_text && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase text-muted">Previous text</p>
                    <RichTextView html={a.old_text} className="mt-1 opacity-70 line-through" />
                  </div>
                )}
                <div className="mt-3">
                  <p className="text-xs font-semibold uppercase text-muted">New text</p>
                  <RichTextView html={a.new_text} className="mt-1" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
