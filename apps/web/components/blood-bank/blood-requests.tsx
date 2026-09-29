'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Hand, Hospital, Loader2, MapPin, Phone, Plus, User, Users } from 'lucide-react';
import { BLOOD_URGENCIES, type BloodGroup, type BloodMe, type BloodRequestRecord, type BloodUrgency } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { BloodDrop, formatDateTime, GroupPicker, PlaceSelect, URGENCY_STYLE } from '@/components/blood-bank/blood-bits';
import { Modal } from '@/components/blood-bank/blood-dialogs';

const STATUS_STYLE: Record<BloodRequestRecord['status'], string> = {
  open: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
  fulfilled: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
  cancelled: 'bg-slate-100 text-slate-600',
  expired: 'bg-slate-100 text-slate-600',
};

export function RequestStatus({ status }: { status: BloodRequestRecord['status'] }) {
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize', STATUS_STYLE[status])}>{status}</span>;
}

export function RequestCard({ r }: { r: BloodRequestRecord }) {
  const u = URGENCY_STYLE[r.urgency];
  const place = [r.thana?.name, r.district?.name].filter(Boolean).join(', ');
  return (
    <Link
      href={`/community/blood-bank/requests/${r.id}`}
      className={cn(
        'flex gap-4 rounded-2xl border bg-surface p-4 shadow-sm transition hover:shadow-md',
        r.urgency === 'critical' && r.status === 'open' ? 'border-red-300' : 'border-border',
      )}
    >
      <div className="flex flex-col items-center gap-1">
        <BloodDrop group={r.blood_group} size="lg" />
        <span className="text-xs font-semibold text-muted">
          {r.units} bag{r.units === 1 ? '' : 's'}
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {r.status === 'open' ? <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', u.className)}>{u.label}</span> : <RequestStatus status={r.status} />}
          {r.is_mine && <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white">Your request</span>}
          {r.i_responded && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700 ring-1 ring-red-200">You offered</span>}
          {r.status === 'open' && r.compatible && !r.is_mine && !r.i_responded && (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">You can help</span>
          )}
        </div>
        <p className="flex items-center gap-1.5 font-semibold">
          <Hospital className="h-4 w-4 shrink-0 text-red-600" />
          <span className="truncate">{r.hospital}</span>
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3.5 w-3.5" /> Needed {formatDateTime(r.needed_on)}
          </span>
          {place && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" /> {place}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" /> {r.response_count} offer{r.response_count === 1 ? '' : 's'}
          </span>
        </div>
        {r.patient_name && (
          <p className="flex items-center gap-1 text-xs text-muted">
            <User className="h-3.5 w-3.5" /> Patient: {r.patient_name}
          </p>
        )}
      </div>
    </Link>
  );
}

function localInputValue(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function RequestForm({ me, phone, name, onClose, onCreated }: { me: BloodMe; phone?: string; name?: string; onClose: () => void; onCreated: (r: BloodRequestRecord) => void }) {
  const [group, setGroup] = useState<BloodGroup | ''>('');
  const [units, setUnits] = useState(1);
  const [urgency, setUrgency] = useState<BloodUrgency>('urgent');
  const [hospital, setHospital] = useState('');
  const [place, setPlace] = useState({ districtId: me.donor.district?.id ?? '', thanaId: '' });
  const [address, setAddress] = useState('');
  const [neededOn, setNeededOn] = useState(() => localInputValue(new Date(Date.now() + 6 * 3600_000)));
  const [patient, setPatient] = useState('');
  const [contactName, setContactName] = useState(name ?? '');
  const [contactPhone, setContactPhone] = useState(phone ?? '');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    setError('');
    if (!group) return setError('Choose the patient’s blood group.');
    if (!place.districtId) return setError('Choose the district.');
    const when = new Date(neededOn);
    if (Number.isNaN(when.getTime())) return setError('Enter when the blood is needed.');
    setBusy(true);
    try {
      const r = await apiFetch<{ data: BloodRequestRecord }>('/blood-bank/requests', {
        method: 'POST',
        body: JSON.stringify({
          blood_group: group,
          units,
          urgency,
          hospital,
          district_id: place.districtId,
          thana_id: place.thanaId,
          address,
          needed_on: when.toISOString(),
          patient_name: patient,
          contact_name: contactName,
          contact_phone: contactPhone,
          note,
        }),
      });
      onCreated(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not post the request');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Request blood" onClose={onClose} wide>
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Patient’s blood group <span className="text-destructive">*</span>
          </p>
          <GroupPicker value={group} onChange={setGroup} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="req-units" className="text-sm font-medium">
              Bags needed
            </label>
            <Input id="req-units" type="number" min={1} max={10} value={units} onChange={(e) => setUnits(Math.max(1, Math.min(10, Number(e.target.value) || 1)))} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <label htmlFor="req-when" className="text-sm font-medium">
              Needed by <span className="text-destructive">*</span>
            </label>
            <Input id="req-when" type="datetime-local" value={neededOn} onChange={(e) => setNeededOn(e.target.value)} />
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-sm font-medium">Urgency</p>
          <div className="flex gap-2">
            {BLOOD_URGENCIES.map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUrgency(u)}
                className={cn(
                  'flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition',
                  urgency === u ? 'border-transparent ' + URGENCY_STYLE[u].className : 'border-border text-foreground hover:bg-slate-50',
                )}
              >
                {URGENCY_STYLE[u].label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="req-hospital" className="text-sm font-medium">
            Hospital <span className="text-destructive">*</span>
          </label>
          <Input id="req-hospital" value={hospital} maxLength={200} onChange={(e) => setHospital(e.target.value)} placeholder="e.g. Dhaka Medical College Hospital, Ward 5" />
        </div>
        <PlaceSelect idPrefix="req" requireDistrict districtId={place.districtId} thanaId={place.thanaId} onChange={setPlace} />
        <div className="space-y-1.5">
          <label htmlFor="req-address" className="text-sm font-medium">
            Address / directions
          </label>
          <Input id="req-address" value={address} maxLength={300} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label htmlFor="req-patient" className="text-sm font-medium">
              Patient name
            </label>
            <Input id="req-patient" value={patient} maxLength={120} onChange={(e) => setPatient(e.target.value)} placeholder="Optional" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="req-cname" className="text-sm font-medium">
              Contact person <span className="text-destructive">*</span>
            </label>
            <Input id="req-cname" value={contactName} maxLength={120} onChange={(e) => setContactName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="req-cphone" className="text-sm font-medium">
              Contact mobile <span className="text-destructive">*</span>
            </label>
            <Input id="req-cphone" value={contactPhone} inputMode="tel" maxLength={11} onChange={(e) => setContactPhone(e.target.value)} placeholder="01XXXXXXXXX" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="req-note" className="text-sm font-medium">
            Details
          </label>
          <textarea id="req-note" className="ibas-textarea" rows={3} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Diagnosis, whole blood or platelets, anything donors should know" />
        </div>
        <p className="text-xs text-muted">Eligible donors of compatible groups in the chosen district get a notification right away.</p>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-red-600 hover:bg-red-700">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            Post request
          </Button>
        </div>
      </div>
    </Modal>
  );
}

type Scope = 'open' | 'can_help' | 'mine' | 'responded' | 'closed';
const SCOPES: Array<{ id: Scope; label: string }> = [
  { id: 'open', label: 'All open' },
  { id: 'can_help', label: 'I can help' },
  { id: 'mine', label: 'My requests' },
  { id: 'responded', label: 'I offered' },
  { id: 'closed', label: 'Closed' },
];

export function RequestList({ me, onNew, reloadKey }: { me: BloodMe; onNew: () => void; reloadKey: number }) {
  const [scope, setScope] = useState<Scope>(me.blood_group ? 'can_help' : 'open');
  const [districtId, setDistrictId] = useState('');
  const [items, setItems] = useState<BloodRequestRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function url(p: number) {
    const s = new URLSearchParams({ page: String(p), limit: '20', scope: scope === 'can_help' ? 'open' : scope });
    if (scope === 'can_help') s.set('can_help', 'true');
    if (districtId) s.set('district_id', districtId);
    return `/blood-bank/requests?${s}`;
  }

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    apiFetch<{ data: BloodRequestRecord[]; meta: { total: number } }>(url(1))
      .then((r) => {
        if (!live) return;
        setItems(r.data);
        setTotal(r.meta.total);
        setPage(1);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load requests'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [scope, districtId, reloadKey]);

  async function loadMore() {
    const r = await apiFetch<{ data: BloodRequestRecord[]; meta: { total: number } }>(url(page + 1));
    setItems((cur) => [...cur, ...r.data]);
    setTotal(r.meta.total);
    setPage(page + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface p-3 shadow-sm lg:flex-row lg:items-end">
        <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1">
          {SCOPES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setScope(s.id)}
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                scope === s.id ? 'border-red-600 bg-red-600 text-white' : 'border-border text-foreground hover:border-red-300',
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <div className="lg:w-64">
          <PlaceSelect idPrefix="reqf" showThana={false} districtId={districtId} thanaId="" onChange={(p) => setDistrictId(p.districtId)} />
        </div>
        <Button onClick={onNew} className="bg-red-600 hover:bg-red-700">
          <Plus className="h-4 w-4" /> Request blood
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-32 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={scope === 'mine' ? 'You haven’t requested blood' : scope === 'can_help' ? 'No open requests for your blood group' : 'No requests here'}
          description={scope === 'can_help' ? 'You’ll get a notification when someone nearby needs your blood group (if you’re a donor).' : undefined}
          action={
            <Button onClick={onNew} className="bg-red-600 hover:bg-red-700">
              <Plus className="h-4 w-4" /> Request blood
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((r) => (
              <RequestCard key={r.id} r={r} />
            ))}
          </div>
          {items.length < total && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={() => void loadMore()}>
                Load more ({total - items.length} left)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function RespondButton({ r, onChange, disabledReason }: { r: BloodRequestRecord; onChange: (r: BloodRequestRecord) => void; disabledReason?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function toggle() {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ data: BloodRequestRecord }>(`/blood-bank/requests/${r.id}/respond`, { method: 'POST', body: '{}' });
      onChange(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-2">
      <Button
        onClick={toggle}
        disabled={busy || (!r.i_responded && !!disabledReason)}
        variant={r.i_responded ? 'outline' : 'default'}
        className={cn('w-full', !r.i_responded && 'bg-red-600 hover:bg-red-700')}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Hand className="h-4 w-4" />}
        {r.i_responded ? 'Withdraw my offer' : 'I can donate'}
      </Button>
      {!r.i_responded && disabledReason && <p className="text-center text-xs text-muted">{disabledReason}</p>}
      {error && <Alert variant="error">{error}</Alert>}
    </div>
  );
}

export function CallRow({ name, phone }: { name: string; phone: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <Phone className="h-4 w-4 text-red-600" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{name}</p>
        <p className="text-xs tabular-nums text-muted">{phone}</p>
      </div>
      <a href={`tel:${phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700">
        <Phone className="h-4 w-4" /> Call
      </a>
    </div>
  );
}
