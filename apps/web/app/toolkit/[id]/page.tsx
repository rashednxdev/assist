'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Pencil } from 'lucide-react';
import type { ToolkitItemDetail } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';
import { toolkitKindLabel } from '@/lib/policy-labels';
import { useIbasAreas } from '@/lib/use-ibas-areas';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { ChecklistRunner } from '@/components/toolkit/checklist-runner';
import { TemplateFiller } from '@/components/toolkit/template-filler';
import { GuideReader } from '@/components/toolkit/guide-reader';
import { RefLinks } from '@/components/toolkit/ref-links';
import { AttachmentLinks } from '@/components/toolkit/attachment-links';

export default function ToolkitItemPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<ToolkitItemDetail | null>(null);
  const [error, setError] = useState('');
  const [admin, setAdmin] = useState(false);
  const { areaName } = useIbasAreas();

  useEffect(() => {
    setItem(null);
    setError('');
    apiFetch<{ data: ToolkitItemDetail }>(`/toolkit/${id}`)
      .then((r) => setItem(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'));
    fetchMe()
      .then((r) => setAdmin(isPlatformAdmin(r.data)))
      .catch(() => undefined);
  }, [id]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title="Toolkit" backHref="/toolkit" backLabel="Toolkit" />
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={item.title}
        description={item.title_bn}
        backHref="/toolkit"
        backLabel="Toolkit"
        className="print:[&_a]:hidden"
        action={
          admin && (
            <Button asChild variant="outline" className="print:hidden">
              <Link href={`/admin/toolkit/${item.id}`}>
                <Pencil className="h-4 w-4" /> Edit
              </Link>
            </Button>
          )
        }
      />

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Badge>{toolkitKindLabel(item.kind)}</Badge>
        <Badge variant="secondary">{item.category_label}</Badge>
        {item.areas.map((a) => (
          <Link key={a} href={`/ibas?area=${a}`}>
            <Badge variant="outline">{areaName(a)}</Badge>
          </Link>
        ))}
        {!item.is_published && <Badge variant="warning">Draft — only admins can see this</Badge>}
      </div>

      {(item.summary || item.refs.length > 0 || item.attachments.length > 0) && (
        <Card className="print:border-0 print:shadow-none">
          <CardContent className="space-y-3 pt-5">
            {item.summary && <p className="whitespace-pre-line text-sm text-foreground">{item.summary}</p>}
            {item.refs.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">Governing rules & circulars</p>
                <RefLinks refs={item.refs} />
              </div>
            )}
            {item.attachments.length > 0 && (
              <div className="space-y-1.5 print:hidden">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted">
                  Files ({item.attachments.length})
                </p>
                <AttachmentLinks files={item.attachments} />
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {item.kind === 'checklist' && <ChecklistRunner item={item} />}
      {item.kind === 'template' && <TemplateFiller item={item} />}
      {item.kind === 'guide' && <GuideReader item={item} />}

      <p className="text-xs text-muted print:hidden">
        Always verify against the latest official rules and circulars before acting on this content.
      </p>
    </div>
  );
}
