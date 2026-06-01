'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';

interface AuditRow {
  id: string;
  actor_name_en: string;
  actor_role: string;
  action: string;
  description: string;
  entity_type: string;
  severity: string;
  created_at: string;
}

function severityVariant(s: string): 'secondary' | 'warning' | 'destructive' {
  if (s === 'critical') return 'destructive';
  if (s === 'warning') return 'warning';
  return 'secondary';
}

export default function AuditLogPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: AuditRow[] }>('/audit/logs?limit=100')
      .then((r) => setRows(r.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit log"
        description="Append-only record of workflow and system actions."
      />

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg">Recent activity</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            className="border-0 shadow-none rounded-none"
            loading={loading}
            data={rows}
            emptyTitle="No audit entries"
            emptyDescription="Actions will be logged as users interact with workflows."
            columns={[
              {
                key: 'time',
                header: 'Time',
                className: 'whitespace-nowrap',
                cell: (r) => (
                  <span className="text-xs text-muted">{new Date(r.created_at).toLocaleString()}</span>
                ),
              },
              {
                key: 'actor',
                header: 'Actor',
                cell: (r) => (
                  <div>
                    <div className="font-medium">{r.actor_name_en}</div>
                    <div className="text-xs text-muted">{r.actor_role}</div>
                  </div>
                ),
              },
              {
                key: 'action',
                header: 'Action',
                cell: (r) => <Badge variant="outline">{r.action}</Badge>,
              },
              {
                key: 'desc',
                header: 'Description',
                cell: (r) => <span className="text-sm">{r.description}</span>,
              },
              {
                key: 'severity',
                header: 'Severity',
                cell: (r) => <Badge variant={severityVariant(r.severity)}>{r.severity}</Badge>,
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
