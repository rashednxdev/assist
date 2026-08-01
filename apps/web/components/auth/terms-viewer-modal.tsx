'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { TermsRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { StructuredSectionsPanel } from '@/components/questions/question-answer-view';

export function TermsViewerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [terms, setTerms] = useState<TermsRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || terms) return;
    setLoading(true);
    setError('');
    apiFetch<{ data: TermsRecord }>('/terms')
      .then((res) => setTerms(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [open, terms]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-xl bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-lg font-semibold">{terms?.header ?? 'Terms and Conditions'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-muted hover:bg-slate-100 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : !terms || terms.sections.length === 0 ? (
            <p className="text-sm text-muted">No terms have been published yet.</p>
          ) : (
            <div className="space-y-4">
              {terms.sections.map((section, i) => (
                <StructuredSectionsPanel key={i} heading={`Section ${i + 1}`} sections={[section]} />
              ))}
            </div>
          )}
        </div>
        <div className="border-t border-border px-5 py-3 text-right">
          <Button type="button" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
