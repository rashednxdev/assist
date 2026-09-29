'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { DesignationRecord, OfficeOption, WorkIdentity } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { publishWorkIdentity, useWorkIdentity } from '@/lib/use-work-identity';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { OfficePicker } from '@/components/org/office-picker';

export function designationLabel(d: { name: string; short_name?: string; grade: number | null }): string {
  const bits = [d.short_name && d.short_name !== d.name ? d.short_name : '', d.grade ? `Grade ${d.grade}` : ''].filter(Boolean);
  return bits.length ? `${d.name} (${bits.join(', ')})` : d.name;
}

/** Pick office + designation and save them to the signed-in user's profile. */
export function WorkIdentityForm({
  submitLabel = 'Save',
  onSaved,
  onCancel,
}: {
  submitLabel?: string;
  onSaved?: (w: WorkIdentity) => void;
  onCancel?: () => void;
}) {
  const { identity } = useWorkIdentity();
  const [designations, setDesignations] = useState<DesignationRecord[]>([]);
  const [office, setOffice] = useState<OfficeOption | null>(identity?.office ?? null);
  const [designationId, setDesignationId] = useState(identity?.designation?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiFetch<{ data: DesignationRecord[] }>('/org/designations')
      .then((r) => setDesignations(r.data))
      .catch(() => setDesignations([]));
  }, []);

  useEffect(() => {
    if (!identity) return;
    setOffice((cur) => cur ?? identity.office ?? null);
    setDesignationId((cur) => cur || identity.designation?.id || '');
  }, [identity]);

  async function save() {
    setError('');
    setSaved(false);
    if (!office) return setError('Choose your office.');
    if (!designationId) return setError('Choose your designation.');
    setBusy(true);
    try {
      const r = await apiFetch<{ data: WorkIdentity }>('/org/me', {
        method: 'PUT',
        body: JSON.stringify({ office_id: office.id, designation_id: designationId }),
      });
      publishWorkIdentity(r.data);
      setSaved(true);
      onSaved?.(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="work-designation">Designation</Label>
          <select id="work-designation" className="ibas-select" value={designationId} onChange={(e) => setDesignationId(e.target.value)}>
            <option value="">Select designation</option>
            {designations.map((d) => (
              <option key={d.id} value={d.id}>
                {designationLabel(d)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="work-office">Office</Label>
          <OfficePicker id="work-office" value={office} onChange={setOffice} />
        </div>
      </div>
      {designations.length === 0 && (
        <p className="text-xs text-muted">No designations have been added yet. Please ask an administrator.</p>
      )}
      {error && <Alert variant="error">{error}</Alert>}
      {saved && !onSaved && <Alert variant="success">Office and designation saved.</Alert>}
      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="button" onClick={save} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
