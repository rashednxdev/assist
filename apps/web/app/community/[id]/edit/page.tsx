'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import type { CommunityThreadDetail } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';
import { ThreadForm } from '@/components/community/thread-form';

export default function EditDiscussionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [thread, setThread] = useState<CommunityThreadDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: CommunityThreadDetail }>(`/community/threads/${id}?view=false`)
      .then((r) => {
        if (!r.data.can_edit) setError('You can only edit your own discussions.');
        setThread(r.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the discussion'));
  }, [id]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Edit discussion" backHref={`/community/${id}`} backLabel="Back to discussion" />
      {error ? (
        <Alert variant="error">{error}</Alert>
      ) : !thread ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : (
        <ThreadForm
          initial={{
            title: thread.title,
            body: thread.body,
            category_id: thread.category?.id ?? '',
            tags: thread.tags,
            links: thread.links,
          }}
          submitLabel="Save changes"
          onCancel={() => router.push(`/community/${id}`)}
          onSubmit={async (payload) => {
            await apiFetch(`/community/threads/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
            router.push(`/community/${id}`);
          }}
        />
      )}
    </div>
  );
}
