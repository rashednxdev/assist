'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import type { OfficeOption, OfficeRecord, OfficeTypeRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { OfficePicker } from '@/components/org/office-picker';

interface GeoTree {
  _id: string;
  name_en: string;
  districts: Array<{ _id: string; name_en: string; thanas: Array<{ _id: string; name_en: string }> }>;
}

interface Form {
  name: string;
  name_bn: string;
  short_name: string;
  office_code: string;
  office_type_id: string;
  parent: OfficeOption | null;
  email: string;
  mobile: string;
  telephone: string;
  pabx: string;
  fax: string;
  web_address: string;
  address: string;
  district_id: string;
  thana_id: string;
  description: string;
  serial_no: number;
  is_active: boolean;
}

function toOption(o: OfficeRecord): OfficeOption {
  return { id: o.id, name: o.name, short_name: o.short_name, office_code: o.office_code, type_short: o.office_type?.short_name, parent_path: o.parent_path };
}

function Field({ label, htmlFor, children, className, hint }: { label: string; htmlFor?: string; children: React.ReactNode; className?: string; hint?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ''}`}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** One form for every office: leave "Parent office" empty for a top-level office, or pick one to make a sub-office. */
export function OfficeForm({
  office,
  parent,
  offices,
  types,
  onSaved,
  onClose,
}: {
  office: OfficeRecord | null;
  /** Pre-selected parent when adding a sub-office. */
  parent: OfficeRecord | null;
  offices: OfficeRecord[];
  types: OfficeTypeRecord[];
  onSaved: () => void;
  onClose: () => void;
}) {
  const byId = useMemo(() => new Map(offices.map((o) => [o.id, o])), [offices]);
  const initialParent = office?.parent_id ? byId.get(office.parent_id) : parent;
  const [form, setForm] = useState<Form>({
    name: office?.name ?? '',
    name_bn: office?.name_bn ?? '',
    short_name: office?.short_name ?? '',
    office_code: office?.office_code ?? '',
    office_type_id: office?.office_type?.id ?? types.find((t) => t.is_active)?.id ?? '',
    parent: initialParent ? toOption(initialParent) : null,
    email: office?.email ?? '',
    mobile: office?.mobile ?? '',
    telephone: office?.telephone ?? '',
    pabx: office?.pabx ?? '',
    fax: office?.fax ?? '',
    web_address: office?.web_address ?? '',
    address: office?.address ?? '',
    district_id: office?.district_id ?? initialParent?.district_id ?? '',
    thana_id: office?.thana_id ?? '',
    description: office?.description ?? '',
    serial_no: office?.serial_no ?? 0,
    is_active: office?.is_active ?? true,
  });
  const [geo, setGeo] = useState<GeoTree[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<{ data: GeoTree[] }>('/setup/geography/tree')
      .then((r) => setGeo(r.data))
      .catch(() => setGeo([]));
  }, []);

  const districts = useMemo(() => geo.flatMap((d) => d.districts.map((x) => ({ ...x, division: d.name_en }))), [geo]);
  const thanas = districts.find((d) => d._id === form.district_id)?.thanas ?? [];
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.name.trim().length < 2) return setError('Enter the office name.');
    if (!form.office_type_id) return setError('Choose an office type (add one in the Office types tab first).');
    setBusy(true);
    const { parent: p, ...rest } = form;
    try {
      await apiFetch(office ? `/org/admin/offices/${office.id}` : '/org/admin/offices', {
        method: office ? 'PUT' : 'POST',
        body: JSON.stringify({ ...rest, parent_id: p?.id ?? null, district_id: rest.district_id || null, thana_id: rest.thana_id || null }),
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:py-10" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <form onSubmit={save} className="relative w-full max-w-3xl space-y-5 rounded-2xl bg-surface p-5 shadow-xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{office ? 'Edit office' : form.parent ? 'Add sub-office' : 'Add office'}</h2>
            <p className="text-sm text-muted">Leave “Parent office” empty for a top-level office.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Office</h3>
          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Office name" htmlFor="of-name" className="sm:col-span-4">
              <Input id="of-name" autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. District Accounts Office, Gazipur" />
            </Field>
            <Field label="Short name" htmlFor="of-short" className="sm:col-span-2">
              <Input id="of-short" value={form.short_name} onChange={(e) => set('short_name', e.target.value)} placeholder="e.g. DAO Gazipur" />
            </Field>
            <Field label="Office name (Bangla)" htmlFor="of-bn" className="sm:col-span-4">
              <Input id="of-bn" value={form.name_bn} onChange={(e) => set('name_bn', e.target.value)} placeholder="ঐচ্ছিক" />
            </Field>
            <Field label="Office code" htmlFor="of-code" className="sm:col-span-2" hint="Must be unique if given">
              <Input id="of-code" value={form.office_code} onChange={(e) => set('office_code', e.target.value)} className="font-mono" placeholder="e.g. 3301" />
            </Field>
            <Field label="Office type" htmlFor="of-type" className="sm:col-span-2">
              <select id="of-type" className="ibas-select" value={form.office_type_id} onChange={(e) => set('office_type_id', e.target.value)}>
                <option value="">Select type</option>
                {types
                  .filter((t) => t.is_active || t.id === form.office_type_id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.short_name})
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Parent office" htmlFor="of-parent" className="sm:col-span-4" hint="Makes this a sub-office of the chosen office">
              <OfficePicker id="of-parent" value={form.parent} onChange={(o) => set('parent', o)} excludeId={office?.id} allowClear placeholder="None — top-level office" />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Contact</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Email" htmlFor="of-email">
              <Input id="of-email" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="office@example.gov.bd" />
            </Field>
            <Field label="Mobile" htmlFor="of-mobile">
              <Input id="of-mobile" value={form.mobile} onChange={(e) => set('mobile', e.target.value)} placeholder="01XXXXXXXXX" />
            </Field>
            <Field label="Telephone" htmlFor="of-tel">
              <Input id="of-tel" value={form.telephone} onChange={(e) => set('telephone', e.target.value)} placeholder="02-XXXXXXX" />
            </Field>
            <Field label="PABX" htmlFor="of-pabx">
              <Input id="of-pabx" value={form.pabx} onChange={(e) => set('pabx', e.target.value)} placeholder="e.g. 9512345, Ext. 210" />
            </Field>
            <Field label="Fax" htmlFor="of-fax">
              <Input id="of-fax" value={form.fax} onChange={(e) => set('fax', e.target.value)} />
            </Field>
            <Field label="Web address" htmlFor="of-web">
              <Input id="of-web" value={form.web_address} onChange={(e) => set('web_address', e.target.value)} placeholder="www.example.gov.bd" />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Location</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="District" htmlFor="of-district">
              <select
                id="of-district"
                className="ibas-select"
                value={form.district_id}
                onChange={(e) => setForm((f) => ({ ...f, district_id: e.target.value, thana_id: '' }))}
              >
                <option value="">Not set</option>
                {districts.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name_en} ({d.division})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Upazila / Thana" htmlFor="of-thana">
              <select id="of-thana" className="ibas-select" value={form.thana_id} onChange={(e) => set('thana_id', e.target.value)} disabled={!form.district_id}>
                <option value="">Not set</option>
                {thanas.map((t) => (
                  <option key={t._id} value={t._id}>
                    {t.name_en}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Address" htmlFor="of-address" className="sm:col-span-2">
              <textarea id="of-address" rows={2} className="ibas-textarea min-h-0" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Building, road, area" />
            </Field>
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Other</h3>
          <div className="grid gap-3 sm:grid-cols-4">
            <Field label="Description / notes" htmlFor="of-desc" className="sm:col-span-3">
              <Input id="of-desc" value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Jurisdiction, remarks…" />
            </Field>
            <Field label="Serial no." htmlFor="of-serial">
              <Input id="of-serial" type="number" min={0} value={form.serial_no} onChange={(e) => set('serial_no', Number(e.target.value) || 0)} />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />
            Active (users can choose this office)
          </label>
        </section>

        {error && <Alert variant="error">{error}</Alert>}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {office ? 'Save changes' : 'Create office'}
          </Button>
        </div>
      </form>
    </div>
  );
}
