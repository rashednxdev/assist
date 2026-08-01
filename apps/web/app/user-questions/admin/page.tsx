'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { AdminSubmittedQuestionRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';

interface QuestionOption {
  id: string;
  body_en: string;
  body_bn?: string;
  question_type_code: string;
  marks: number;
}

const STATUS_TABS = ['pending', 'accepted', 'rejected'] as const;

function statusVariant(status: string): 'warning' | 'success' | 'destructive' {
  if (status === 'accepted') return 'success';
  if (status === 'rejected') return 'destructive';
  return 'warning';
}

function truncate(text: string, len = 200) {
  return text.length > len ? `${text.slice(0, len)}…` : text;
}

export default function UserQuestionsAdminPage() {
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>('pending');
  const [rows, setRows] = useState<AdminSubmittedQuestionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [linkResults, setLinkResults] = useState<QuestionOption[]>([]);
  const [linkSelected, setLinkSelected] = useState<string>('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: AdminSubmittedQuestionRecord[] }>(
        `/user-questions/admin?status=${status}`,
      );
      setRows(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (!linkingId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLinkLoading(true);
        try {
          const params = new URLSearchParams({ is_published: 'true', limit: '20' });
          if (linkSearch.trim()) params.set('q', linkSearch.trim());
          const r = await apiFetch<{ data: QuestionOption[] }>(`/questions?${params.toString()}`);
          if (!cancelled) setLinkResults(r.data);
        } catch {
          if (!cancelled) setLinkResults([]);
        } finally {
          if (!cancelled) setLinkLoading(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [linkingId, linkSearch]);

  function startLinking(id: string) {
    setLinkingId(id);
    setLinkSearch('');
    setLinkResults([]);
    setLinkSelected('');
  }

  function cancelLinking() {
    setLinkingId(null);
    setLinkSearch('');
    setLinkResults([]);
    setLinkSelected('');
  }

  async function confirmAccept(id: string) {
    if (!linkSelected) return;
    setSaving(true);
    setError('');
    try {
      await apiFetch(`/user-questions/${id}/accept`, {
        method: 'POST',
        body: JSON.stringify({ linked_question_id: linkSelected }),
      });
      cancelLinking();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept');
    } finally {
      setSaving(false);
    }
  }

  async function reject(id: string) {
    const note = window.prompt('Optional note for the user (why was this rejected)?') ?? undefined;
    try {
      await apiFetch(`/user-questions/${id}/reject`, {
        method: 'POST',
        body: JSON.stringify({ admin_note: note?.trim() || undefined }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submitted Questions"
        description="Questions users submitted for a subject. Accept and link a real question (with model answer) to answer them, or reject."
      />

      {error && <Alert variant="error">{error}</Alert>}

      <div className="flex gap-2">
        {STATUS_TABS.map((s) => (
          <Button
            key={s}
            type="button"
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => setStatus(s)}
            className="capitalize"
          >
            {s}
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base capitalize">{status} submissions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted">No {status} submissions.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row) => (
                <div key={row.id} className="rounded-lg border border-border p-4 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium">{row.user_name}</span>
                      <span className="mx-2 text-muted">·</span>
                      <span>{row.subject_name}</span>
                    </div>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </div>
                  <p className="mt-2">{truncate(row.body)}</p>
                  {row.admin_note && (
                    <p className="mt-1 text-xs text-muted">Note: {row.admin_note}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {new Date(row.created_at).toLocaleString()}
                  </p>

                  {row.status === 'pending' && (
                    <div className="mt-3 flex gap-2">
                      <Button type="button" size="sm" onClick={() => startLinking(row.id)}>
                        Accept &amp; link question
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => void reject(row.id)}>
                        Reject
                      </Button>
                    </div>
                  )}

                  {linkingId === row.id && (
                    <div className="mt-3 space-y-2 rounded-md border border-border bg-slate-50/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Input
                          value={linkSearch}
                          onChange={(e) => setLinkSearch(e.target.value)}
                          placeholder="Search published questions to link as the answer..."
                        />
                        <Link
                          href="/questions/new"
                          target="_blank"
                          className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium text-primary hover:text-primary-dark"
                        >
                          New question
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </div>
                      {linkLoading ? (
                        <p className="text-xs text-muted">Searching...</p>
                      ) : linkResults.length === 0 ? (
                        <p className="text-xs text-muted">No matching questions.</p>
                      ) : (
                        <div className="max-h-56 space-y-1 overflow-y-auto">
                          {linkResults.map((q) => (
                            <label
                              key={q.id}
                              className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 text-xs hover:bg-white"
                            >
                              <input
                                type="radio"
                                name={`link-${row.id}`}
                                checked={linkSelected === q.id}
                                onChange={() => setLinkSelected(q.id)}
                              />
                              <span>
                                {truncate(q.body_en || q.body_bn || '', 140)}
                                <span className="ml-2 text-muted">
                                  ({q.question_type_code}, {q.marks}m)
                                </span>
                              </span>
                            </label>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={!linkSelected || saving}
                          onClick={() => void confirmAccept(row.id)}
                        >
                          {saving ? 'Saving...' : 'Confirm link'}
                        </Button>
                        <Button type="button" size="sm" variant="outline" onClick={cancelLinking}>
                          Cancel
                        </Button>
                      </div>
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
