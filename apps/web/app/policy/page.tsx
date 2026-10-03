'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Archive, BookOpen, Briefcase, ChevronRight, Landmark, Library } from 'lucide-react';
import type { PolicyCollectionSummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

export default function PolicyLibraryPage() {
  const [collections, setCollections] = useState<PolicyCollectionSummary[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: PolicyCollectionSummary[] }>('/policy/collections')
      .then((r) => setCollections(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load the policy library'));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Policy Library"
        description="Acts, rules and circulars grouped by subject — procurement, financial rules, service rules, tax and audit."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/circulars">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700">
                <Archive className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Digital Circular Archive</p>
                <p className="text-sm text-muted">Search circulars, SROs, gazettes and office orders by number, subject or year.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/ibas">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-800">
                <Briefcase className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">iBAS++ Workspace</p>
                <p className="text-sm text-muted">Procedures, rules, circulars and tools for each iBAS++ area in one place.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted" />
            </CardContent>
          </Card>
        </Link>
        <Link href="/policy/archive">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardContent className="flex items-center gap-4 pt-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Library className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-foreground">Books &amp; Policy Archive</p>
                <p className="text-sm text-muted">Read archived books, download them as PDF, and browse “Know, Because you asked any more”.</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted" />
            </CardContent>
          </Card>
        </Link>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {!collections && !error ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(collections ?? []).map((col) => (
            <Card key={col.code}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-start gap-3 text-base">
                  <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    <span className="block">{col.name_en}</span>
                    <span className="block text-sm font-normal text-muted">{col.name_bn}</span>
                  </span>
                </CardTitle>
                <p className="text-sm text-muted">{col.description_en}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                {col.books.length === 0 ? (
                  <p className="text-sm text-muted">No books added to this collection yet.</p>
                ) : (
                  <div className="space-y-1.5">
                    {col.books.map((b) => (
                      <Link
                        key={b.id}
                        href={`/books/${b.id}`}
                        className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <BookOpen className="h-4 w-4 shrink-0 text-muted" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{b.name}</span>
                          {b.name_bn && <span className="block truncate text-xs text-muted">{b.name_bn}</span>}
                        </span>
                        {b.book_type_name && <Badge variant="outline">{b.book_type_name}</Badge>}
                        {!b.is_published && <Badge variant="warning">Draft</Badge>}
                      </Link>
                    ))}
                  </div>
                )}
                <Link
                  href={`/circulars?collection=${col.code}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  <Archive className="h-4 w-4" />
                  {col.circular_count} circular{col.circular_count === 1 ? '' : 's'} in this collection
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
