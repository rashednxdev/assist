'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface RegulationRow {
  id: string;
  regulation_no: string;
  title: string;
  regulation_type: string;
  is_amended: boolean;
  payment_related: boolean;
  effective_date: string;
}

export default function RegulationsSearchPage() {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<RegulationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  function search(query?: string) {
    setLoading(true);
    setSearched(true);
    const term = query ?? q;
    const params = new URLSearchParams();
    if (term.trim()) params.set('q', term.trim());
    apiFetch<{ data: RegulationRow[] }>(`/books/regulations/search?${params}`)
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    search('');
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/books">
            <ArrowLeft className="h-4 w-4" />
            Books
          </Link>
        </Button>
      </div>

      <PageHeader title="Regulation search" description="Find rules by number, title, or keyword." />

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Search className="h-5 w-5 text-primary" />
            Search
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 p-4">
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              search();
            }}
          >
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="e.g. GFR-45, receipts, treasury..."
              className="flex-1"
            />
            <Button type="submit" disabled={loading}>
              Search
            </Button>
          </form>

          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : items.length === 0 && searched ? (
            <EmptyState title="No regulations found" description="Try a different search term." />
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {items.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/books/regulations/${r.id}`}
                    className="flex flex-col gap-1 px-4 py-3 transition-colors hover:bg-slate-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <span className="font-semibold text-foreground">{r.regulation_no}</span>
                      <span className="mx-2 text-muted">·</span>
                      <span className="text-sm">{r.title}</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="outline">{r.regulation_type}</Badge>
                      {r.is_amended && <Badge variant="warning">Amended</Badge>}
                      {r.payment_related && <Badge variant="secondary">Payment</Badge>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
