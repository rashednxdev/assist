'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Droplet, Plus, Trash2 } from 'lucide-react';
import type { BloodDonationRecord, BloodMe } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { publishBloodMe } from '@/lib/use-blood-me';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { formatDate } from '@/components/blood-bank/blood-bits';

export function DonationHistory({ me, onAdd }: { me: BloodMe; onAdd: () => void }) {
  const [rows, setRows] = useState<BloodDonationRecord[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiFetch<{ data: BloodDonationRecord[] }>('/blood-bank/donations')
      .then((r) => setRows(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load donations'));
  }, []);

  useEffect(load, [load, me.donor.donation_count, me.donor.last_donation_date]);

  async function remove(id: string) {
    if (!confirm('Remove this donation from your history?')) return;
    try {
      const r = await apiFetch<{ data: BloodMe }>(`/blood-bank/donations/${id}`, { method: 'DELETE' });
      publishBloodMe(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove');
    }
  }

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!rows) return <Skeleton className="h-48 rounded-2xl" />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">My donations</h2>
          <p className="text-sm text-muted">
            {rows.length} donation{rows.length === 1 ? '' : 's'} recorded · each one can help up to three people
          </p>
        </div>
        <Button onClick={onAdd} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4" /> I donated
        </Button>
      </div>
      {rows.length === 0 ? (
        <EmptyState title="No donations recorded" description="After you donate, record it here. We work out your next eligible date and pause requests to you until then." />
      ) : (
        <ol className="relative space-y-3 border-l-2 border-red-100 pl-6">
          {rows.map((d) => (
            <li key={d.id} className="relative rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <span className="absolute -left-[33px] top-4 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 ring-4 ring-white">
                <Droplet className="h-3 w-3 fill-white text-white" />
              </span>
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="font-semibold">{formatDate(d.donated_on)}</p>
                  {d.place && <p className="text-sm text-foreground">{d.place}</p>}
                  <p className="text-xs text-muted">Next eligible {formatDate(d.next_eligible_on)}</p>
                  {d.note && <p className="text-xs text-muted">{d.note}</p>}
                  {d.request_id && (
                    <Link href={`/community/blood-bank/requests/${d.request_id}`} className="text-xs font-medium text-red-700 hover:underline">
                      For a blood request
                    </Link>
                  )}
                </div>
                <button type="button" onClick={() => void remove(d.id)} className="rounded-lg p-1.5 text-muted hover:bg-destructive-light hover:text-destructive" title="Remove">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
