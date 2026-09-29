'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, PauseCircle } from 'lucide-react';
import { BLOOD_GROUPS, type BloodGroup, type BloodUrgency, type GeoOption } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

/** "3 months ago", "12 days ago", "today". */
export function sinceLabel(iso: string | null | undefined): string {
  if (!iso) return 'Never donated here';
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Donated today';
  if (days < 45) return `Donated ${days} day${days === 1 ? '' : 's'} ago`;
  const months = Math.floor(days / 30.4);
  if (months < 24) return `Donated ${months} month${months === 1 ? '' : 's'} ago`;
  return `Donated ${Math.floor(months / 12)} years ago`;
}

export function todayInput(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Blood group in a drop-shaped badge. */
export function BloodDrop({ group, size = 'md', className }: { group: BloodGroup | string | null; size?: 'sm' | 'md' | 'lg' | 'xl'; className?: string }) {
  const dims = { sm: 'h-8 w-8 text-[11px]', md: 'h-11 w-11 text-sm', lg: 'h-14 w-14 text-lg', xl: 'h-20 w-20 text-2xl' }[size];
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-b from-rose-500 to-red-700 font-extrabold text-white shadow-sm',
        dims,
        !group && 'from-slate-300 to-slate-400',
        className,
      )}
    >
      {group ?? '?'}
    </span>
  );
}

export function GroupPicker({ value, onChange, disabled }: { value: BloodGroup | '' | null; onChange: (g: BloodGroup) => void; disabled?: boolean }) {
  return (
    <div className="grid grid-cols-4 gap-2" role="radiogroup" aria-label="Blood group">
      {BLOOD_GROUPS.map((g) => (
        <button
          key={g}
          type="button"
          role="radio"
          aria-checked={value === g}
          disabled={disabled}
          onClick={() => onChange(g)}
          className={cn(
            'rounded-xl border-2 py-2.5 text-base font-extrabold transition',
            value === g ? 'border-red-600 bg-red-600 text-white shadow-sm' : 'border-border bg-surface text-red-700 hover:border-red-300 hover:bg-red-50',
          )}
        >
          {g}
        </button>
      ))}
    </div>
  );
}

export function EligibilityBadge({ eligible, days, available = true, className }: { eligible: boolean; days: number; available?: boolean; className?: string }) {
  if (!available) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600', className)}>
        <PauseCircle className="h-3 w-3" /> Not available now
      </span>
    );
  }
  if (eligible) {
    return (
      <span className={cn('inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200', className)}>
        <CheckCircle2 className="h-3 w-3" /> Eligible now
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 ring-1 ring-amber-200', className)}>
      <Clock className="h-3 w-3" /> Eligible in {days} day{days === 1 ? '' : 's'}
    </span>
  );
}

export const URGENCY_STYLE: Record<BloodUrgency, { label: string; className: string }> = {
  critical: { label: 'Critical', className: 'bg-red-600 text-white' },
  urgent: { label: 'Urgent', className: 'bg-amber-500 text-white' },
  normal: { label: 'Normal', className: 'bg-slate-100 text-slate-700' },
};

let districtCache: GeoOption[] | null = null;

/** District + thana selects backed by the blood bank's public place lists. */
export function PlaceSelect({
  districtId,
  thanaId,
  onChange,
  requireDistrict,
  districtLabel = 'District',
  showThana = true,
  idPrefix = 'place',
  districtPlaceholder,
}: {
  districtPlaceholder?: string;
  districtId: string;
  thanaId: string;
  onChange: (next: { districtId: string; thanaId: string }) => void;
  requireDistrict?: boolean;
  districtLabel?: string;
  showThana?: boolean;
  idPrefix?: string;
}) {
  const [districts, setDistricts] = useState<GeoOption[]>(districtCache ?? []);
  const [thanas, setThanas] = useState<GeoOption[]>([]);

  useEffect(() => {
    if (districtCache) return;
    apiFetch<{ data: GeoOption[] }>('/blood-bank/places/districts')
      .then((r) => {
        districtCache = r.data;
        setDistricts(r.data);
      })
      .catch(() => setDistricts([]));
  }, []);

  useEffect(() => {
    if (!showThana || !districtId) {
      setThanas([]);
      return;
    }
    let live = true;
    apiFetch<{ data: GeoOption[] }>(`/blood-bank/places/districts/${districtId}/thanas`)
      .then((r) => live && setThanas(r.data))
      .catch(() => live && setThanas([]));
    return () => {
      live = false;
    };
  }, [districtId, showThana]);

  return (
    <div className={cn('grid gap-3', showThana && 'sm:grid-cols-2')}>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-district`} className="text-sm font-medium">
          {districtLabel}
          {requireDistrict && <span className="text-destructive"> *</span>}
        </label>
        <select id={`${idPrefix}-district`} className="ibas-select" value={districtId} onChange={(e) => onChange({ districtId: e.target.value, thanaId: '' })}>
          <option value="">{districtPlaceholder ?? (requireDistrict ? 'Select district' : 'Any district')}</option>
          {districts.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      {showThana && (
        <div className="space-y-1.5">
          <label htmlFor={`${idPrefix}-thana`} className="text-sm font-medium">
            Thana / upazila
          </label>
          <select id={`${idPrefix}-thana`} className="ibas-select" value={thanaId} disabled={!districtId} onChange={(e) => onChange({ districtId, thanaId: e.target.value })}>
            <option value="">{districtId ? 'Any thana' : 'Choose a district first'}</option>
            {thanas.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

export function Toggle({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string; disabled?: boolean }) {
  return (
    <div className={cn('flex items-start justify-between gap-4', disabled && 'opacity-60')}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs text-muted">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-red-600' : 'bg-slate-300')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </div>
  );
}
