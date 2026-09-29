'use client';

import { useRouter } from 'next/navigation';
import { Lightbulb } from 'lucide-react';
import type { CommunityThreadDetail } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { ThreadForm } from '@/components/community/thread-form';

export default function NewDiscussionPage() {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Start a discussion"
        description="Ask a question or share something new with colleagues. It's published right away."
        backHref="/community"
        backLabel="Community"
      />
      <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Good discussions have a specific title, the steps you already tried, and a tagged <strong>workflow</strong>, <strong>checklist</strong> or <strong>circular</strong> so others can check the same source.
        </p>
      </div>
      <ThreadForm
        submitLabel="Publish discussion"
        onCancel={() => router.push('/community')}
        onSubmit={async (payload) => {
          const r = await apiFetch<{ data: CommunityThreadDetail }>('/community/threads', { method: 'POST', body: JSON.stringify(payload) });
          router.push(`/community/${r.data.id}`);
        }}
      />
    </div>
  );
}
