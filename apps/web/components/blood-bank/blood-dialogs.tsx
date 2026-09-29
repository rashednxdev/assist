'use client';

import { useMemo, useState } from 'react';
import { Droplet, Loader2, X } from 'lucide-react';
import { BLOOD_DONATION_GAP_MONTHS, defaultNextEligible, type BloodDonationRecord, type BloodMe } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { publishBloodMe } from '@/lib/use-blood-me';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { formatDate, todayInput } from '@/components/blood-bank/blood-bits';
import { BloodProfileForm } from '@/components/blood-bank/blood-profile-form';

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl sm:p-6 ${wide ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-muted hover:bg-slate-100" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

const toInput = (d: Date) => d.toISOString().slice(0, 10);

/** "I donated" — logs a donation; the next eligible date defaults to 3 months later. */
export function DonationDialog({ requestId, onClose, onSaved }: { requestId?: string; onClose: () => void; onSaved?: (m: BloodMe) => void }) {
  const [donatedOn, setDonatedOn] = useState(todayInput());
  const [customNext, setCustomNext] = useState('');
  const [place, setPlace] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const minNext = useMemo(() => (donatedOn ? toInput(defaultNextEligible(new Date(`${donatedOn}T00:00:00Z`))) : ''), [donatedOn]);
  const nextOn = customNext && customNext >= minNext ? customNext : minNext;

  async function save() {
    setError('');
    if (!donatedOn) return setError('Enter the donation date.');
    setBusy(true);
    try {
      const r = await apiFetch<{ data: { donation: BloodDonationRecord; me: BloodMe } }>('/blood-bank/donations', {
        method: 'POST',
        body: JSON.stringify({ donated_on: donatedOn, next_eligible_on: nextOn, place, note, request_id: requestId ?? '' }),
      });
      publishBloodMe(r.data.me);
      onSaved?.(r.data.me);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Record a donation" onClose={onClose}>
      <div className="space-y-4">
        <div className="flex items-center gap-3 rounded-xl bg-red-50 p-3 text-sm text-red-900">
          <Droplet className="h-5 w-5 shrink-0 fill-red-500 text-red-600" />
          Thank you for donating! Keeping this up to date lets people know when you can donate again.
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="don-date" className="text-sm font-medium">
              Donation date <span className="text-destructive">*</span>
            </label>
            <Input id="don-date" type="date" value={donatedOn} max={todayInput()} onChange={(e) => setDonatedOn(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="don-next" className="text-sm font-medium">
              Next eligible date
            </label>
            <Input id="don-next" type="date" value={nextOn} min={minNext} onChange={(e) => setCustomNext(e.target.value)} />
          </div>
        </div>
        <p className="-mt-1 text-xs text-muted">
          Set to {BLOOD_DONATION_GAP_MONTHS} months after the donation ({formatDate(minNext ? `${minNext}T00:00:00Z` : null)}). Choose a later date if your doctor advised it.
        </p>
        <div className="space-y-1.5">
          <label htmlFor="don-place" className="text-sm font-medium">
            Hospital / blood bank
          </label>
          <Input id="don-place" value={place} maxLength={150} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. Sandhani, DMCH" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="don-note" className="text-sm font-medium">
            Note
          </label>
          <Input id="don-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Optional" />
        </div>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy} className="bg-red-600 hover:bg-red-700">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Save donation
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function BloodProfileDialog({ me, onClose }: { me: BloodMe; onClose: () => void }) {
  return (
    <Modal title="Blood group & donor settings" onClose={onClose} wide>
      <BloodProfileForm me={me} submitLabel="Save" onSaved={onClose} onCancel={onClose} />
    </Modal>
  );
}
