'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Video } from 'lucide-react';
import {
  formatBdt,
  liveSubjectWaiverQuote,
  type AccessPackageRecord,
  type BillingCatalog,
  type CartRecord,
  type LiveProgramRecord,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { durationLabel } from '@/lib/billing-format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';

const MAX = 4;

function subjectLabel(pkg: AccessPackageRecord): string {
  return pkg.exam_subject_names?.filter(Boolean).join(', ') || pkg.exam_subject_name || pkg.name;
}

function ProgramCard({
  program,
  classes,
  ownedIds,
  disabled,
}: {
  program: LiveProgramRecord;
  classes: AccessPackageRecord[];
  ownedIds: Set<string>;
  disabled: boolean;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const chosen = classes.filter((c) => picked.includes(c.id));
  const quote = liveSubjectWaiverQuote(
    chosen.map((c) => ({ id: c.id, programId: program.id, price: c.price, subjects: 1 })),
    [program],
  );
  const payable = chosen.reduce((sum, c) => sum + (quote.priceById[c.id] ?? c.price), 0);
  const full = chosen.reduce((sum, c) => sum + c.price, 0);
  const percent = quote.groups[0]?.percent ?? 0;

  function toggle(id: string) {
    setError('');
    setPicked((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX) return prev;
      return [...prev, id];
    });
  }

  async function enroll() {
    if (chosen.length === 0) return;
    setBusy(true);
    setError('');
    try {
      const r = await apiFetch<{ data: CartRecord }>('/billing/carts', {
        method: 'POST',
        body: JSON.stringify({ package_ids: chosen.map((c) => c.id) }),
      });
      router.push(`/checkout/cart/${r.data.cart_id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the enrollment');
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{program.name}</CardTitle>
        {program.name_bn && <p className="text-sm text-muted">{program.name_bn}</p>}
        <p className="text-sm text-muted">
          Pick the subjects you want. One subject is the listed price.
          {program.waiver_2 > 0 ? ` Two subjects are ${program.waiver_2}% less.` : ''}
          {program.waiver_3 > 0 ? ` Three subjects are ${program.waiver_3}% less.` : ''}
          {program.waiver_4 > 0 ? ` Four subjects are ${program.waiver_4}% less.` : ''}
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-2">
          {classes.map((c) => {
            const owned = ownedIds.has(c.id);
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <label className={`flex items-start gap-3 rounded-lg border px-3 py-2 ${owned ? 'border-emerald-200 bg-emerald-50' : 'border-border'}`}>
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={on}
                    disabled={owned || disabled || (!on && picked.length >= MAX)}
                    onChange={() => toggle(c.id)}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{subjectLabel(c)}</span>
                      <span className="text-sm text-muted">
                        {c.class_count ?? c.class_limit ?? 0} classes · {durationLabel(c.duration_days)}
                      </span>
                      {owned && <span className="text-xs font-semibold text-emerald-700">Enrolled</span>}
                    </span>
                    <span className="text-sm font-semibold">{c.price === 0 ? 'Free' : formatBdt(on ? (quote.priceById[c.id] ?? c.price) : c.price)}</span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
        {error && <Alert variant="error">{error}</Alert>}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-muted">
            {chosen.length === 0
              ? 'Select a subject to enroll.'
              : percent > 0
                ? `${chosen.length} subjects · ${percent}% waiver · ${formatBdt(payable)} (was ${formatBdt(full)})`
                : `${chosen.length} subject${chosen.length === 1 ? '' : 's'} · ${formatBdt(payable)}`}
          </p>
          <Button disabled={disabled || busy || chosen.length === 0} onClick={() => void enroll()}>
            <Video className="h-4 w-4" />
            {busy ? 'Starting…' : 'Enroll'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Live classes grouped under the admin's package name, with that package's multi-subject waiver. */
export function LiveClassShop({ catalog }: { catalog: BillingCatalog }) {
  const programs = catalog.live_programs ?? [];
  const live = catalog.packages.filter((p) => p.kind === 'live');
  const ownedIds = useMemo(() => new Set(catalog.access.live_packages.map((p) => p.package_id)), [catalog.access.live_packages]);
  const grouped = programs
    .map((program) => ({
      program,
      classes: live.filter((p) => p.live_program_id === program.id),
    }))
    .filter((g) => g.classes.length > 0);
  const loose = live.filter((p) => !p.live_program_id);
  const disabled = !catalog.settings.gateway_enabled || catalog.can_request === false;

  return (
    <div className="space-y-4">
      {grouped.map(({ program, classes }) => (
        <ProgramCard key={program.id} program={program} classes={classes} ownedIds={ownedIds} disabled={disabled} />
      ))}
      {loose.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loose.map((p) => (
            <Card key={p.id}>
              <CardHeader>
                <CardTitle className="text-lg">{p.name}</CardTitle>
                <p className="text-2xl font-bold">{p.price === 0 ? 'Free' : formatBdt(p.price)}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Check className="h-4 w-4" />
                  {p.class_count ?? 0} classes · {durationLabel(p.duration_days)}
                </p>
                {ownedIds.has(p.id) ? (
                  <p className="text-sm font-semibold text-emerald-700">Enrolled</p>
                ) : (
                  <Button
                    className="w-full"
                    disabled={disabled}
                    onClick={() => {
                      void apiFetch<{ data: { id: string } }>('/billing/orders', {
                        method: 'POST',
                        body: JSON.stringify({ package_id: p.id }),
                      }).then((r) => {
                        window.location.href = `/checkout/${r.data.id}`;
                      });
                    }}
                  >
                    Enroll
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
