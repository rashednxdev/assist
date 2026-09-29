'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Droplet, HandHeart, Loader2, Pencil } from 'lucide-react';
import type { BloodGroup } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useBloodMe } from '@/lib/use-blood-me';
import { Alert } from '@/components/ui/alert';
import { BloodDrop, EligibilityBadge, formatDate, GroupPicker, sinceLabel } from '@/components/blood-bank/blood-bits';
import { BloodProfileDialog, DonationDialog } from '@/components/blood-bank/blood-dialogs';

/** Personal dashboard: set the blood group in one tap and see donor eligibility. */
export function BloodDashboardCard() {
  const { me, refresh } = useBloodMe();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [dialog, setDialog] = useState<'donation' | 'settings' | null>(null);

  async function saveGroup(g: BloodGroup) {
    setBusy(true);
    setError('');
    try {
      await apiFetch('/account/profile', { method: 'PATCH', body: JSON.stringify({ blood_group: g }) });
      await refresh();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  if (!me) return null;
  const d = me.donor;
  const needsGroup = !me.blood_group;

  return (
    <div className="overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-rose-50 via-white to-white shadow-sm">
      <div className="flex flex-wrap items-center gap-4 p-5">
        <BloodDrop group={me.blood_group} size="lg" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <p className="font-bold">{needsGroup ? 'Add your blood group' : d.is_donor ? `${me.blood_group} blood donor` : `Blood group ${me.blood_group}`}</p>
            {!needsGroup && !editing && (
              <button type="button" onClick={() => setEditing(true)} className="rounded p-1 text-muted hover:bg-rose-100 hover:text-red-700" title="Change blood group">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {needsGroup ? (
            <p className="text-sm text-muted">Needed to open the community blood bank, find donors and request blood.</p>
          ) : d.is_donor ? (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <EligibilityBadge eligible={d.eligible} days={d.days_until_eligible} available={d.available} />
              <span>
                {sinceLabel(d.last_donation_date)}
                {!d.eligible && d.next_eligible_date && ` · next ${formatDate(d.next_eligible_date)}`}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted">Become a donor so colleagues can find you when they need {me.blood_group} blood.</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {!needsGroup && d.is_donor && (
            <button type="button" onClick={() => setDialog('donation')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700">
              <HandHeart className="h-4 w-4" /> I donated
            </button>
          )}
          {!needsGroup && !d.is_donor && (
            <button type="button" onClick={() => setDialog('settings')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700">
              <Droplet className="h-4 w-4" /> Become a donor
            </button>
          )}
          {!needsGroup && (
            <Link href="/community/blood-bank" className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-700 hover:bg-rose-50">
              Blood bank <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
      {(needsGroup || editing) && (
        <div className="space-y-2 border-t border-red-100 px-5 pb-5 pt-4">
          <GroupPicker value={me.blood_group} onChange={(g) => void saveGroup(g)} disabled={busy} />
          <div className="flex items-center justify-between text-xs text-muted">
            <span>{busy ? <Loader2 className="inline h-3.5 w-3.5 animate-spin" /> : 'Tap your blood group to save it.'}</span>
            {editing && (
              <button type="button" className="font-medium hover:text-foreground" onClick={() => setEditing(false)}>
                Cancel
              </button>
            )}
          </div>
          {error && <Alert variant="error">{error}</Alert>}
        </div>
      )}
      {dialog === 'donation' && <DonationDialog onClose={() => setDialog(null)} />}
      {dialog === 'settings' && <BloodProfileDialog me={me} onClose={() => setDialog(null)} />}
    </div>
  );
}
