'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { RoleBadge } from '@/components/workflow/role-badge';

interface InboxItem {
  id: string;
  task_name_en: string;
  current_step: number;
  current_role: string;
  status: string;
  fiscal_year: string;
  month?: string;
  last_activity_at: string;
}

export default function WorkflowInboxPage() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: InboxItem[] }>('/workflow/inbox')
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Inbox" description="Pending runs waiting for your workflow roles." />

      <Card>
        <CardHeader>
          <CardTitle>Pending actions</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted">No pending items in your inbox.</p>
          ) : (
            <ul className="space-y-3">
              {items.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-shadow hover:shadow-md">
                  <div>
                    <div className="font-medium">{item.task_name_en}</div>
                    <div className="mt-1 flex items-center gap-2 text-sm text-muted">
                      Step {item.current_step} · {item.fiscal_year}
                      {item.month && ` · ${item.month}`}
                    </div>
                    <RoleBadge code={item.current_role} className="mt-2" />
                  </div>
                  <Link href={`/workflow/guide?run=${item.id}`} className="text-sm text-primary hover:underline">
                    Open run →
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
