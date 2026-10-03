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

/** Pick department, office and designation and save them to the signed-in user's profile. */
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
  const [department, setDepartment] = useState<OfficeOption | null>(identity?.department ?? null);
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
    setDepartment((cur) => cur ?? identity.department ?? null);
    setOffice((cur) => cur ?? identity.office ?? null);
    setDesignationId((cur) => cur || identity.designation?.id || '');
  }, [identity]);

  function chooseDepartment(d: OfficeOption | null) {
    setDepartment(d);
    if (d?.id !== department?.id) setOffice(d);
  }

  async function save() {
    setError('');
    setSaved(false);
    if (!department) return setError('Choose your department.');
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
          <Label htmlFor="work-department">Department</Label>
          <OfficePicker id="work-department" value={department} onChange={chooseDepartment} topLevel placeholder="Choose your department…" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="work-office">Office</Label>
          <OfficePicker
            id="work-office"
            value={office}
            onChange={setOffice}
            departmentId={department?.id}
            disabled={!department}
            placeholder={department ? 'Search offices in this department…' : 'Choose the department first'}
          />
        </div>
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
      </div>
      <p className="text-xs text-muted">
        A department is a top-level office. Pick the department itself if you work at its head office.
      </p>
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
