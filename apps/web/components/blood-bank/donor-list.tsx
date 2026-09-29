'use client';

import { useEffect, useState } from 'react';
import { Award, Building2, Loader2, MapPin, MessageCircle, Phone, Search } from 'lucide-react';
import { BLOOD_GROUPS, donorGroupsFor, type BloodDonorRecord, type BloodGroup } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { BloodDrop, EligibilityBadge, formatDate, PlaceSelect, sinceLabel, Toggle } from '@/components/blood-bank/blood-bits';

const PAGE = 30;

function whatsapp(phone: string): string | null {
  const d = phone.replace(/\D/g, '');
  return /^01[3-9]\d{8}$/.test(d) ? `https://wa.me/880${d.slice(1)}` : null;
}

export function DonorCard({ d }: { d: BloodDonorRecord }) {
  const location = [d.area, d.thana, d.district].filter(Boolean).join(', ');
  const wa = d.phone ? whatsapp(d.phone) : null;
  return (
    <article className={cn('flex flex-col gap-3 rounded-2xl border bg-surface p-4 shadow-sm transition hover:shadow-md', d.is_me ? 'border-red-300 ring-1 ring-red-100' : 'border-border')}>
      <div className="flex items-start gap-3">
        <BloodDrop group={d.blood_group} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">
            {d.name}
            {d.is_me && <span className="ml-1.5 rounded bg-red-600 px-1.5 py-0.5 align-middle text-[10px] font-semibold text-white">You</span>}
          </p>
          {(d.designation || d.office) && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
              <Building2 className="h-3 w-3 shrink-0" />
              {[d.designation, d.office].filter(Boolean).join(', ')}
            </p>
          )}
          {location && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
              <MapPin className="h-3 w-3 shrink-0" />
              {location}
            </p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <EligibilityBadge eligible={d.eligible} days={d.days_until_eligible} available={d.available} />
        {d.donation_count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-rose-100">
            <Award className="h-3 w-3" /> {d.donation_count} donation{d.donation_count === 1 ? '' : 's'}
          </span>
        )}
      </div>
      <p className="text-xs text-muted">
        {sinceLabel(d.last_donation_date)}
        {!d.eligible && d.next_eligible_date && ` · can donate from ${formatDate(d.next_eligible_date)}`}
      </p>
      <div className="mt-auto flex items-center gap-2 border-t border-border pt-3">
        {d.phone ? (
          <>
            <a href={`tel:${d.phone}`} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-600 text-sm font-semibold text-white shadow-sm hover:bg-red-700">
              <Phone className="h-4 w-4" /> Call
            </a>
            {wa && (
              <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted hover:text-emerald-600" title="WhatsApp">
                <MessageCircle className="h-4 w-4" />
              </a>
            )}
            <span className="hidden text-xs tabular-nums text-muted sm:inline">{d.phone}</span>
          </>
        ) : (
          <p className="text-xs text-muted">Number kept private — post a request to reach this donor.</p>
        )}
      </div>
    </article>
  );
}

/** Donor search: exact group or "compatible with patient", location, eligible-only. */
export function DonorList({ myGroup, initialGroup }: { myGroup: BloodGroup | null; initialGroup?: BloodGroup | '' }) {
  const [mode, setMode] = useState<'exact' | 'patient'>('exact');
  const [group, setGroup] = useState<BloodGroup | ''>(initialGroup ?? '');
  const [place, setPlace] = useState({ districtId: '', thanaId: '' });
  const [eligibleOnly, setEligibleOnly] = useState(true);
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');

  const [items, setItems] = useState<BloodDonorRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialGroup !== undefined) setGroup(initialGroup);
  }, [initialGroup]);

  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  function url(p: number) {
    const s = new URLSearchParams({ page: String(p), limit: String(PAGE), eligible: String(eligibleOnly) });
    if (group) s.set(mode === 'patient' ? 'compatible_with' : 'group', group);
    if (place.districtId) s.set('district_id', place.districtId);
    if (place.thanaId) s.set('thana_id', place.thanaId);
    if (q) s.set('q', q);
    return `/blood-bank/donors?${s}`;
  }

  useEffect(() => {
    let live = true;
    setLoading(true);
    setError('');
    apiFetch<{ data: BloodDonorRecord[]; meta: { total: number } }>(url(1))
      .then((r) => {
        if (!live) return;
        setItems(r.data);
        setTotal(r.meta.total);
        setPage(1);
      })
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load donors'))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [mode, group, place.districtId, place.thanaId, eligibleOnly, q]);

  async function loadMore() {
    setMore(true);
    try {
      const r = await apiFetch<{ data: BloodDonorRecord[]; meta: { total: number } }>(url(page + 1));
      setItems((cur) => [...cur, ...r.data]);
      setTotal(r.meta.total);
      setPage(page + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load more');
    } finally {
      setMore(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {(
              [
                ['exact', 'Donor group'],
                ['patient', 'Patient needs'],
              ] as const
            ).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn('rounded-md px-3 py-1.5 text-xs font-semibold transition', mode === m ? 'bg-red-600 text-white shadow-sm' : 'text-muted hover:text-foreground')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setGroup('')}
              className={cn('rounded-full border px-3 py-1 text-xs font-bold transition', !group ? 'border-red-600 bg-red-600 text-white' : 'border-border text-foreground hover:border-red-300')}
            >
              All
            </button>
            {BLOOD_GROUPS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-bold transition',
                  group === g ? 'border-red-600 bg-red-600 text-white' : 'border-border text-red-700 hover:border-red-300',
                  g === myGroup && group !== g && 'ring-1 ring-red-200',
                )}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        {mode === 'patient' && group && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-900">
            A <strong>{group}</strong> patient can receive from: <strong>{donorGroupsFor(group).join(', ')}</strong>
          </p>
        )}
        <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
          <PlaceSelect idPrefix="find" districtId={place.districtId} thanaId={place.thanaId} onChange={setPlace} />
          <div className="space-y-1.5">
            <label htmlFor="donor-q" className="text-sm font-medium">
              Name or area
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input id="donor-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search donors" className="pl-9" />
            </div>
          </div>
        </div>
        <Toggle label="Eligible donors only" hint="Hide donors who donated in the last 3 months or are unavailable." checked={eligibleOnly} onChange={setEligibleOnly} />
      </div>

      {error && <Alert variant="error">{error}</Alert>}
      {loading ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={eligibleOnly ? 'No eligible donors found' : 'No donors found'}
          description={eligibleOnly ? 'Try another district, turn off "Eligible donors only", or post a blood request so matching donors are notified.' : 'Try another blood group or district.'}
        />
      ) : (
        <>
          <p className="text-sm text-muted">
            {total} {eligibleOnly ? 'eligible ' : ''}donor{total === 1 ? '' : 's'}
          </p>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {items.map((d) => (
              <DonorCard key={d.id} d={d} />
            ))}
          </div>
          {items.length < total && (
            <div className="flex justify-center">
              <Button variant="outline" onClick={loadMore} disabled={more}>
                {more && <Loader2 className="h-4 w-4 animate-spin" />}
                Load more ({total - items.length} left)
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
