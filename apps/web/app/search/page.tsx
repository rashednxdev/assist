'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ChevronRight, Lock, Search } from 'lucide-react';
import type { SearchGroup, SearchResponse } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const LOCKED_LABEL: Record<SearchGroup, string> = {
  areas: 'iBAS++ areas',
  tools: 'Tools',
  rules: 'Rules',
  books: 'Books',
  circulars: 'Circulars',
  regulations: 'Regulations',
  questions: 'Question bank',
  procedures: 'Procedures',
  toolkit: 'Checklists, templates & guides',
};

function SearchResults() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const q = params.get('q')?.trim() ?? '';
  const [input, setInput] = useState(q);
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setInput(q);
    if (q.length < 2) {
      setResult(null);
      return;
    }
    setLoading(true);
    setError('');
    apiFetch<{ data: SearchResponse }>(`/search?q=${encodeURIComponent(q)}`)
      .then((r) => setResult(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Search failed'))
      .finally(() => setLoading(false));
  }, [q]);

  const totalHits = result?.groups.reduce((n, g) => n + g.hits.length, 0) ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Search"
        description="One search across the iBAS++ Workspace, rules, circulars, regulations, procedures, tools and the question bank."
      />

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const next = input.trim();
          router.replace(next ? `${pathname}?q=${encodeURIComponent(next)}` : pathname);
        }}
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="e.g. EFT, bill return, GPF advance, rule 104, VAT at source…"
            className="h-11 pl-9"
          />
        </div>
        <Button type="submit" className="h-11">
          Search
        </Button>
      </form>

      {error && <Alert variant="error">{error}</Alert>}

      {q.length < 2 ? (
        <EmptyState title="Type at least 2 characters" description="Try an iBAS++ term, a rule number, a circular number or a keyword." />
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : result ? (
        <>
          {totalHits === 0 ? (
            <EmptyState title={`No results for “${result.q}”`} description="Try a shorter or different keyword." />
          ) : (
            <div className="space-y-4">
              {result.groups.map((g) => (
                <Card key={g.group}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted">
                      {g.label} <span className="font-normal">({g.hits.length})</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="divide-y divide-border">
                    {g.hits.map((h) => (
                      <Link key={`${g.group}-${h.id}`} href={h.href} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0 hover:text-primary">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground">{h.title}</p>
                          {h.subtitle && <p className="text-xs text-muted">{h.subtitle}</p>}
                          {h.snippet && <p className="mt-1 line-clamp-2 text-sm text-muted">{h.snippet}</p>}
                        </div>
                        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted" />
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
          {result.locked.length > 0 && (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Lock className="h-4 w-4" />
              Not searched (no access yet): {result.locked.map((g) => LOCKED_LABEL[g]).join(', ')}.
            </p>
          )}
        </>
      ) : null}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-11 w-full" />}>
      <SearchResults />
    </Suspense>
  );
}
