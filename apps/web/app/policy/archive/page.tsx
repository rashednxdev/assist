'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, ChevronRight, HelpCircle, Settings2 } from 'lucide-react';
import type { ArchiveOverview, KnowQuestionItem } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { KnowQuestions } from '@/components/policy/know-questions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function PolicyArchivePage() {
  const [overview, setOverview] = useState<ArchiveOverview | null>(null);
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [area, setArea] = useState('');
  const [items, setItems] = useState<KnowQuestionItem[] | null>(null);
  const [itemsError, setItemsError] = useState('');

  useEffect(() => {
    apiFetch<{ data: ArchiveOverview }>('/policy/archive')
      .then((r) => {
        setOverview(r.data);
        const first = r.data.areas.find((a) => a.question_count > 0) ?? r.data.areas[0];
        if (first) setArea(first.code);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the archive'));
    fetchMe()
      .then((res) =>
        setIsAdmin(res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin'),
      )
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!area) return;
    setItems(null);
    setItemsError('');
    apiFetch<{ data: KnowQuestionItem[] }>(`/policy/archive/know?area=${encodeURIComponent(area)}`)
      .then((r) => setItems(r.data))
      .catch((e) => setItemsError(e instanceof Error ? e.message : 'Failed to load questions'));
  }, [area]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Books & Query"
        description="Archived books to read or download as PDF, and short answers to the questions people ask most."
        backHref="/policy"
        backLabel="Policy Library"
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="h-5 w-5 text-emerald-700" />
            Books
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!overview && !error ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (overview?.books.length ?? 0) === 0 ? (
            <p className="text-sm text-muted">
              No books in the archive yet.{isAdmin && ' Add them from Book admin with the archive button.'}
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {overview!.books.map((b) => (
                <Link
                  key={b.id}
                  href={`/policy/archive/books/${b.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-slate-50"
                >
                  <BookOpen className="h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{b.name}</span>
                    <span className="block truncate text-xs text-muted">
                      {[b.name_bn, b.edition && `Edition ${b.edition}`, `${b.chapter_count} chapter${b.chapter_count === 1 ? '' : 's'}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {!b.is_published && <Badge variant="warning">Draft</Badge>}
                  <ChevronRight className="h-4 w-4 text-muted" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <HelpCircle className="h-5 w-5 text-emerald-700" />
              Know, Because you asked any more
            </CardTitle>
            {isAdmin && (
              <Button asChild size="sm" variant="outline">
                <Link href={`/admin/archive-know${area ? `?area=${area}` : ''}`}>
                  <Settings2 className="h-4 w-4" />
                  Manage questions
                </Link>
              </Button>
            )}
          </div>
          {overview && overview.areas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {overview.areas.map((a) => (
                <button
                  key={a.code}
                  type="button"
                  onClick={() => setArea(a.code)}
                  className={cn(
                    'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                    area === a.code ? 'text-white' : 'bg-background text-foreground hover:bg-slate-50',
                  )}
                  style={area === a.code ? { backgroundColor: a.color, borderColor: a.color } : { borderColor: a.color }}
                >
                  {a.name_en}
                  <span className="ml-1.5 text-xs opacity-80">{a.question_count}</span>
                </button>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {overview && overview.areas.length === 0 ? (
            <p className="text-sm text-muted">No questions have been added yet.</p>
          ) : itemsError ? (
            <Alert variant="error">{itemsError}</Alert>
          ) : !items ? (
            <div className="space-y-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted">No questions under this area yet.</p>
          ) : (
            <KnowQuestions items={items} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
