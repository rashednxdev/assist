'use client';

import { useEffect, useState } from 'react';
import { Loader2, Users, X } from 'lucide-react';
import {
  SCHEDULE_TARGET_LABELS,
  SCHEDULE_TARGET_TYPES,
  type OfficeOption,
  type OfficeTypeRecord,
  type ScheduleTargetType,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { OfficePicker, officeLabel } from '@/components/org/office-picker';
import { LocationSelects, useGeoTree, type LocationValue } from '@/components/org/location-selects';
import { UserPicker } from '@/components/users/user-picker';

export interface AudienceState {
  target_type: ScheduleTargetType;
  target_user_ids: string[];
  target_office_type_ids: string[];
  target_offices: OfficeOption[];
  target_location: LocationValue;
}

const HINTS: Record<ScheduleTargetType, string> = {
  all: 'Every active user.',
  office_type: 'Users whose office is of the chosen type(s).',
  office: 'Users of the chosen office(s) only, not their sub-offices.',
  office_tree: 'Users of the chosen office(s) and every office below them.',
  location: 'Users whose office is in this division, district or upazila.',
  specific: 'Only the users you pick.',
};

export function audienceBody(a: AudienceState) {
  return {
    target_type: a.target_type,
    target_user_ids: a.target_type === 'specific' ? a.target_user_ids : [],
    target_office_type_ids: a.target_type === 'office_type' ? a.target_office_type_ids : [],
    target_office_ids: a.target_type === 'office' || a.target_type === 'office_tree' ? a.target_offices.map((o) => o.id) : [],
    target_location: a.target_type === 'location' ? a.target_location : {},
  };
}

function incomplete(a: AudienceState): string | null {
  if (a.target_type === 'specific' && !a.target_user_ids.length) return 'Pick at least one user.';
  if (a.target_type === 'office_type' && !a.target_office_type_ids.length) return 'Tick at least one office type.';
  if ((a.target_type === 'office' || a.target_type === 'office_tree') && !a.target_offices.length) return 'Add at least one office.';
  if (a.target_type === 'location' && !a.target_location.division_id) return 'Choose a division.';
  return null;
}

let typesCache: Promise<OfficeTypeRecord[]> | null = null;

export function ScheduleAudienceField({ value, onChange }: { value: AudienceState; onChange: (patch: Partial<AudienceState>) => void }) {
  const geo = useGeoTree();
  const [types, setTypes] = useState<OfficeTypeRecord[]>([]);
  const [reach, setReach] = useState<{ users: number; offices: number | null } | null>(null);
  const [reachBusy, setReachBusy] = useState(false);
  const [reachError, setReachError] = useState('');

  useEffect(() => {
    let live = true;
    typesCache ??= apiFetch<{ data: OfficeTypeRecord[] }>('/org/office-types').then((r) => r.data);
    typesCache.then((t) => live && setTypes(t)).catch(() => {
      typesCache = null;
    });
    return () => {
      live = false;
    };
  }, []);

  const missing = incomplete(value);
  const bodyKey = JSON.stringify(audienceBody(value));

  useEffect(() => {
    setReach(null);
    setReachError('');
    if (missing) return;
    let live = true;
    setReachBusy(true);
    const t = setTimeout(() => {
      apiFetch<{ data: { users: number; offices: number | null } }>('/schedule/admin/audience-preview', { method: 'POST', body: bodyKey })
        .then((r) => live && setReach(r.data))
        .catch((e) => live && setReachError(e instanceof Error ? e.message : 'Could not count users'))
        .finally(() => live && setReachBusy(false));
    }, 350);
    return () => {
      live = false;
      clearTimeout(t);
      setReachBusy(false);
    };
  }, [bodyKey, missing]);

  const toggleType = (id: string) =>
    onChange({
      target_office_type_ids: value.target_office_type_ids.includes(id)
        ? value.target_office_type_ids.filter((x) => x !== id)
        : [...value.target_office_type_ids, id],
    });

  return (
    <div className="space-y-3 rounded-lg border border-border p-3">
      <p className="text-sm font-medium">Who gets this schedule</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {SCHEDULE_TARGET_TYPES.map((t) => (
          <label
            key={t}
            className={cn(
              'flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm',
              value.target_type === t ? 'border-primary bg-primary/5 font-medium' : 'border-border hover:bg-slate-50',
            )}
          >
            <input type="radio" checked={value.target_type === t} onChange={() => onChange({ target_type: t })} />
            {SCHEDULE_TARGET_LABELS[t]}
          </label>
        ))}
      </div>
      <p className="text-xs text-muted">{HINTS[value.target_type]}</p>

      {value.target_type === 'specific' && (
        <UserPicker selectedIds={value.target_user_ids} onChange={(ids) => onChange({ target_user_ids: ids })} />
      )}

      {value.target_type === 'office_type' && (
        <div className="flex flex-wrap gap-1.5">
          {types.length === 0 && <span className="text-xs text-muted">No office types yet. Add them under Admin › Offices.</span>}
          {types
            .filter((t) => t.is_active || value.target_office_type_ids.includes(t.id))
            .map((t) => {
              const on = value.target_office_type_ids.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleType(t.id)}
                  title={t.name}
                  className={cn('rounded-full border px-3 py-1 text-xs', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border')}
                >
                  {t.short_name}
                </button>
              );
            })}
        </div>
      )}

      {(value.target_type === 'office' || value.target_type === 'office_tree') && (
        <div className="space-y-2">
          {value.target_offices.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.target_offices.map((o) => (
                <span key={o.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs">
                  <span className="truncate" title={o.parent_path ? `${o.parent_path} › ${o.name}` : o.name}>
                    {officeLabel(o)}
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove ${o.name}`}
                    onClick={() => onChange({ target_offices: value.target_offices.filter((x) => x.id !== o.id) })}
                    className="rounded-full p-0.5 hover:bg-slate-200"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <OfficePicker
            value={null}
            placeholder={value.target_offices.length ? 'Add another office…' : 'Search an office…'}
            onChange={(o) => o && !value.target_offices.some((x) => x.id === o.id) && onChange({ target_offices: [...value.target_offices, o] })}
          />
        </div>
      )}

      {value.target_type === 'location' && (
        <LocationSelects geo={geo} idPrefix="aud" area emptyLabel="Choose…" value={value.target_location} onChange={(v) => onChange({ target_location: v })} />
      )}

      <div className="flex items-center gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm">
        {reachBusy ? <Loader2 className="h-4 w-4 animate-spin text-muted" /> : <Users className="h-4 w-4 text-muted" />}
        {missing ? (
          <span className="text-muted">{missing}</span>
        ) : reachError ? (
          <span className="text-destructive">{reachError}</span>
        ) : reach ? (
          <span>
            <strong>{reach.users}</strong> user{reach.users === 1 ? '' : 's'} will get this
            {reach.offices !== null && <span className="text-muted"> · {reach.offices} office{reach.offices === 1 ? '' : 's'}</span>}
          </span>
        ) : (
          <span className="text-muted">Counting…</span>
        )}
      </div>
    </div>
  );
}
