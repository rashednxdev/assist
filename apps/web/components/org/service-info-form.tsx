'use client';

import { useEffect, useRef, useState } from 'react';
import { Award, Briefcase, Info, Loader2 } from 'lucide-react';
import {
  BATCH_WINDOW_MONTHS,
  BCS_BATCH_MAX,
  CADRE_GRADE_MAX,
  bcsBatchLabel,
  type DesignationRecord,
  type ServiceInfo,
  type ServiceType,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useWorkIdentity } from '@/lib/use-work-identity';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { designationLabel } from '@/components/org/work-identity-form';

const today = () => new Date().toISOString().slice(0, 10);

/** Cadre (BCS batch + joining date) or non-cadre (joining post + joining date), saved to /org/me/service. */
export function ServiceInfoForm({ submitLabel = 'Save service information', onSaved }: { submitLabel?: string; onSaved?: (info: ServiceInfo) => void }) {
  const [info, setInfo] = useState<ServiceInfo | null>(null);
  const [designations, setDesignations] = useState<DesignationRecord[]>([]);
  const [type, setType] = useState<ServiceType | ''>('');
  const [batch, setBatch] = useState('');
  const [postId, setPostId] = useState('');
  const [joined, setJoined] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const { identity } = useWorkIdentity();
  const currentDesignationId = identity?.designation?.id ?? null;
  const loaded = useRef(false);

  useEffect(() => {
    apiFetch<{ data: DesignationRecord[] }>('/org/designations')
      .then((d) => setDesignations(d.data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    apiFetch<{ data: ServiceInfo }>('/org/me/service')
      .then(({ data: i }) => {
        setInfo(i);
        if (!loaded.current) {
          loaded.current = true;
          setType(i.service_type ?? (i.cadre_allowed ? '' : 'non_cadre'));
          setBatch(i.bcs_batch ? String(i.bcs_batch) : '');
          setPostId(i.joining_designation?.id ?? '');
          setJoined(i.joining_date ? i.joining_date.slice(0, 10) : '');
        } else if (!i.cadre_allowed) {
          setType('non_cadre');
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load service information'));
  }, [currentDesignationId]);

  async function save() {
    setError('');
    setSaved(false);
    if (!type) return setError('Tell us whether you are a BCS cadre officer.');
    if (type === 'cadre' && !batch) return setError('Enter your BCS batch.');
    if (type === 'non_cadre' && !postId) return setError('Choose the post you joined in.');
    if (!joined) return setError('Enter your joining date.');
    setBusy(true);
    try {
      const body = type === 'cadre' ? { service_type: type, bcs_batch: Number(batch), joining_date: joined } : { service_type: type, joining_designation_id: postId, joining_date: joined };
      const r = await apiFetch<{ data: ServiceInfo }>('/org/me/service', { method: 'PUT', body: JSON.stringify(body) });
      setInfo(r.data);
      setSaved(true);
      onSaved?.(r.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  if (!info) return error ? <Alert variant="error">{error}</Alert> : <Skeleton className="h-40 rounded-xl" />;

  const current = info.current_designation;
  const batchNo = Number(batch);

  return (
    <div className="space-y-5">
      {info.cadre_allowed ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            Are you a BCS cadre officer? <span className="text-destructive">*</span>
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {(
              [
                ['cadre', 'Yes, BCS cadre', 'Grouped with your BCS batch', Award],
                ['non_cadre', 'No, non-cadre', 'Grouped by joining post and date', Briefcase],
              ] as const
            ).map(([value, label, hint, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={type === value}
                onClick={() => setType(value)}
                className={cn(
                  'flex items-start gap-3 rounded-xl border-2 p-3 text-left transition',
                  type === value ? 'border-primary bg-primary-muted' : 'border-border hover:border-primary/40',
                )}
              >
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', type === value ? 'text-primary' : 'text-muted')} />
                <span>
                  <span className="block text-sm font-semibold">{label}</span>
                  <span className="block text-xs text-muted">{hint}</span>
                </span>
              </button>
            ))}
          </div>
          {!current && <p className="text-xs text-muted">Cadre service applies to grades 1–{CADRE_GRADE_MAX}. Add your designation above so we can check.</p>}
        </div>
      ) : (
        <p className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          Your designation ({current?.name}, grade {current?.grade}) is a non-cadre post. BCS cadre applies to grades 1–{CADRE_GRADE_MAX}.
        </p>
      )}

      {type === 'cadre' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label htmlFor="svc-batch" className="text-sm font-medium">
              BCS batch <span className="text-destructive">*</span>
            </label>
            <div className="flex items-center gap-2">
              <Input id="svc-batch" type="number" inputMode="numeric" min={1} max={BCS_BATCH_MAX} value={batch} onChange={(e) => setBatch(e.target.value.replace(/\D/g, '').slice(0, 2))} placeholder="e.g. 27" className="w-28" />
              {batchNo > 0 && <span className="text-sm font-semibold text-primary-dark">{bcsBatchLabel(batchNo)}</span>}
            </div>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="svc-joined" className="text-sm font-medium">
              Service joining date <span className="text-destructive">*</span>
            </label>
            <Input id="svc-joined" type="date" max={today()} value={joined} onChange={(e) => setJoined(e.target.value)} />
          </div>
        </div>
      )}

      {type === 'non_cadre' && (
        <div className="space-y-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor="svc-post" className="text-sm font-medium">
                Joining post <span className="text-destructive">*</span>
              </label>
              <select id="svc-post" className="ibas-select" value={postId} onChange={(e) => setPostId(e.target.value)}>
                <option value="">Select the post you joined in</option>
                {designations.map((d) => (
                  <option key={d.id} value={d.id}>
                    {designationLabel(d)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="svc-joined-post" className="text-sm font-medium">
                Joining date in that post <span className="text-destructive">*</span>
              </label>
              <Input id="svc-joined-post" type="date" max={today()} value={joined} onChange={(e) => setJoined(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted">People who joined the same post within {BATCH_WINDOW_MONTHS} months of each other are grouped as one batch.</p>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {saved && !onSaved && <Alert variant="success">Service information saved.</Alert>}
      <div className="flex justify-end">
        <Button type="button" onClick={save} disabled={busy || !type}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
