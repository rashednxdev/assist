'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, Loader2, ShoppingCart } from 'lucide-react';
import type { ExamPrepPartsResponse } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

/** Part 1 / Part 2 switch for exam-prep pages; the choice is saved on the account and reloads the page content. */
export function ExamPartScope({ children, listPath }: { children: React.ReactNode; listPath: string }) {
  const pathname = usePathname();
  const [state, setState] = useState<ExamPrepPartsResponse | null>(null);
  const [epoch, setEpoch] = useState(0);
  const [switching, setSwitching] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: ExamPrepPartsResponse }>('/exam-prep/parts')
      .then((r) => setState(r.data))
      .catch(() => setState(null));
  }, []);

  async function choose(partId: string) {
    if (!state || partId === state.selected_part_id || switching) return;
    setSwitching(partId);
    setError('');
    try {
      const r = await apiFetch<{ data: ExamPrepPartsResponse }>('/exam-prep/part', {
        method: 'PUT',
        body: JSON.stringify({ exam_part_id: partId }),
      });
      setState(r.data);
      setEpoch((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not switch part');
    } finally {
      setSwitching('');
    }
  }

  const show = pathname === listPath && !!state && !state.is_admin && state.parts.length > 1;
  const current = state?.parts.find((p) => p.id === state.selected_part_id);

  return (
    <>
      {show && (
        <div className="mb-5 space-y-2 rounded-xl border border-border bg-surface p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-muted">
              <Layers className="h-4 w-4" />
              Studying
            </span>
            {state.parts.map((p) => {
              const on = p.id === state.selected_part_id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => choose(p.id)}
                  disabled={!!switching}
                  className={cn(
                    'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-70',
                    on ? 'border-primary bg-primary text-white' : 'border-border hover:bg-slate-50',
                  )}
                >
                  {switching === p.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {p.label}
                  <span className={cn('text-xs font-normal', on ? 'text-white/80' : 'text-muted')}>
                    {p.whole_part ? 'all subjects' : `${p.owned_count}/${p.subjects.length}`}
                  </span>
                </button>
              );
            })}
            {current && !current.whole_part && (
              <Link
                href="/packages?tab=exam_prep"
                className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary-muted/50"
              >
                <ShoppingCart className="h-4 w-4" />
                Buy subjects
              </Link>
            )}
          </div>
          {current && current.owned_count === 0 && (
            <p className="text-sm text-muted">
              You don&apos;t have any subject of {current.label} yet. Buy the subjects you need to see their questions and papers here.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
      <div key={epoch} className="contents">
        {children}
      </div>
    </>
  );
}
