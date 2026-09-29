'use client';

import { useState } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import type { BloodGroup, BloodMe } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { publishBloodMe } from '@/lib/use-blood-me';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { GroupPicker, PlaceSelect, Toggle } from '@/components/blood-bank/blood-bits';

/** Blood group + donor settings, saved to /blood-bank/me. */
export function BloodProfileForm({ me, submitLabel = 'Save', onSaved, onCancel }: { me: BloodMe | null; submitLabel?: string; onSaved?: (m: BloodMe) => void; onCancel?: () => void }) {
  const d = me?.donor;
  const [group, setGroup] = useState<BloodGroup | ''>(me?.blood_group ?? '');
  const [isDonor, setIsDonor] = useState(d?.is_donor ?? false);
  const [available, setAvailable] = useState(d?.available ?? true);
  const [place, setPlace] = useState({ districtId: d?.district?.id ?? '', thanaId: d?.thana?.id ?? '' });
  const [area, setArea] = useState(d?.area ?? '');
  const [showPhone, setShowPhone] = useState(d?.show_phone ?? true);
  const [note, setNote] = useState(d?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const age = me?.age ?? null;
  const ageWarning = isDonor && age !== null && (age < 18 || age > 60);

  async function save() {
    setError('');
    if (!group) return setError('Choose your blood group.');
    if (isDonor && !place.districtId) return setError('Choose the district where you can donate.');
    setBusy(true);
    try {
      const r = await apiFetch<{ data: BloodMe }>('/blood-bank/me', {
        method: 'PUT',
        body: JSON.stringify({
          blood_group: group,
          is_donor: isDonor,
          available,
          district_id: place.districtId,
          thana_id: place.thanaId,
          area,
          show_phone: showPhone,
          note,
        }),
      });
      publishBloodMe(r.data);
      onSaved?.(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="text-sm font-medium">
          Your blood group <span className="text-destructive">*</span>
        </p>
        <GroupPicker value={group} onChange={setGroup} />
      </div>

      <div className="rounded-xl border border-border p-4">
        <Toggle label="I want to be a blood donor" hint="People who need your blood group can find you and send you requests." checked={isDonor} onChange={setIsDonor} />
      </div>

      {isDonor && (
        <div className="space-y-4 rounded-xl border border-red-100 bg-red-50/40 p-4">
          <PlaceSelect idPrefix="donor" districtLabel="Where you can donate" requireDistrict districtId={place.districtId} thanaId={place.thanaId} onChange={setPlace} />
          <div className="space-y-1.5">
            <label htmlFor="donor-area" className="text-sm font-medium">
              Area / nearby hospital
            </label>
            <Input id="donor-area" value={area} maxLength={150} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Segunbagicha, near Dhaka Medical" />
          </div>
          <Toggle label="Available to donate" hint="Turn off while you are ill, travelling or otherwise can't donate." checked={available} onChange={setAvailable} />
          <Toggle label="Show my mobile number" hint="Lets people call you directly. When off, they can still send you requests." checked={showPhone} onChange={setShowPhone} />
          <div className="space-y-1.5">
            <label htmlFor="donor-note" className="text-sm font-medium">
              Note for requesters
            </label>
            <Input id="donor-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Call after 5 pm, weekdays only" />
          </div>
          {ageWarning && (
            <p className="flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Donors are usually 18–60 years old. Your profile says you are {age}. Please check with a doctor before donating.
            </p>
          )}
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={save} disabled={busy} className="bg-red-600 hover:bg-red-700">
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
