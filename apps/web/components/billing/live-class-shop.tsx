'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, Video } from 'lucide-react';
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
import { toBanglaDigits } from '@/lib/bangla-format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { PackageCopy } from '@/components/billing/package-copy';

const MAX = 4;

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

function subjectLabel(pkg: AccessPackageRecord): string {
  return pkg.exam_subject_names?.filter(Boolean).join(', ') || pkg.exam_subject_name || pkg.name;
}

function ProgramCard({
  program,
  classes,
  ownedIds,
  disabled,
  focusSubjectId,
}: {
  program: LiveProgramRecord;
  classes: AccessPackageRecord[];
  ownedIds: Set<string>;
  disabled: boolean;
  focusSubjectId?: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const didAutoFocus = useRef(false);

  useEffect(() => {
    if (!focusSubjectId || didAutoFocus.current || disabled) return;
    const hit = classes.find(
      (c) =>
        !ownedIds.has(c.id) &&
        (c.exam_subject_id === focusSubjectId || (c.exam_subject_ids ?? []).includes(focusSubjectId)),
    );
    if (hit) {
      didAutoFocus.current = true;
      setPicked([hit.id]);
    }
  }, [focusSubjectId, classes, ownedIds, disabled]);

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
      setError(e instanceof Error ? e.message : 'এনরোলমেন্ট শুরু করা যায়নি');
      setBusy(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#d7e4ee] bg-white shadow-xs">
      <div className="border-b border-[#eef4f9] bg-[#0a2f5b] p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full bg-[#1566b8] px-3 py-0.5 text-xs font-semibold">লাইভ ক্লাস প্রোগ্রাম</span>
          {program.waiver_2 > 0 ? (
            <span className="rounded-full bg-white/15 px-3 py-0.5 text-xs font-semibold text-[#9ef0ff]">
              ২ বিষয়ে {bn(program.waiver_2)}% ওয়েভার
              {program.waiver_3 > 0 ? ` · ৩ বিষয়ে ${bn(program.waiver_3)}%` : ''}
              {program.waiver_4 > 0 ? ` · ৪ বিষয়ে ${bn(program.waiver_4)}%` : ''}
            </span>
          ) : null}
        </div>
        <h3 className="mt-2.5 text-xl font-bold">{program.name_bn?.trim() || program.name}</h3>
        {program.description ? (
          <p className="mt-1 whitespace-pre-line text-xs leading-relaxed text-white/80">{program.description}</p>
        ) : null}
        <p className="mt-2 text-xs text-white/70">
          এই প্রোগ্রামের এক বা একাধিক বিষয় একসাথে বেছে এনরোল করতে পারবেন। ভিন্ন প্রোগ্রামের বিষয় আলাদাভাবে কিনতে হয়।
        </p>
      </div>

      <div className="space-y-4 p-5">
        <ul className="space-y-2.5">
          {classes.map((c) => {
            const owned = ownedIds.has(c.id);
            const on = picked.includes(c.id);
            return (
              <li key={c.id}>
                <label
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition',
                    owned
                      ? 'border-[#bce3d6] bg-[#eaf8f2]'
                      : on
                        ? 'border-[#1566b8] bg-[#eaf3fc]'
                        : 'border-[#e3edf6] bg-[#f9fcff] hover:border-[#7eb6ea]',
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-1 h-4 w-4 accent-[#1566b8]"
                    checked={on}
                    disabled={owned || disabled || (!on && picked.length >= MAX)}
                    onChange={() => toggle(c.id)}
                  />
                  <span className="min-w-0 flex-1 space-y-1.5">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[#0a2f5b]">{subjectLabel(c)}</span>
                      <span className="text-base font-extrabold text-[#0a2f5b]">
                        {c.price === 0 ? 'ফ্রি' : formatBdt(on ? (quote.priceById[c.id] ?? c.price) : c.price)}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span>
                        {bn(c.class_count ?? c.class_limit ?? 0)}টি ক্লাস · {durationLabel(c.duration_days)}
                      </span>
                      {owned ? (
                        <span className="inline-flex items-center gap-1 font-bold text-[#156f4d]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          এনরোল করা
                        </span>
                      ) : null}
                    </span>
                    <PackageCopy description={c.description} features={c.features} />
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        {error ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eef4f9] pt-3.5">
          <p className="text-xs font-medium text-slate-600">
            {chosen.length === 0
              ? 'এনরোল করতে অন্তত ১টি বিষয় নির্বাচন করুন।'
              : percent > 0
                ? `${bn(chosen.length)}টি বিষয় · ${bn(percent)}% ওয়েভার · সর্বমোট ${formatBdt(payable)} (পূর্বে ${formatBdt(full)})`
                : `${bn(chosen.length)}টি বিষয় নির্বাচিত · ${formatBdt(payable)}`}
          </p>
          <Button
            disabled={disabled || busy || chosen.length === 0}
            onClick={() => void enroll()}
            className="rounded-xl bg-[#1566b8] text-white hover:bg-[#0f5294]"
          >
            <Video className="h-4 w-4" />
            {busy ? 'অপেক্ষা করুন…' : 'লাইভ ক্লাসে এনরোল করুন'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LiveClassShop({
  catalog,
  focusSubjectId,
}: {
  catalog: BillingCatalog;
  focusSubjectId?: string;
}) {
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
    <div className="space-y-5">
      {grouped.map(({ program, classes }) => (
        <ProgramCard
          key={program.id}
          program={program}
          classes={classes}
          ownedIds={ownedIds}
          disabled={disabled}
          focusSubjectId={focusSubjectId}
        />
      ))}
      {loose.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {loose.map((p) => (
            <div key={p.id} className="flex flex-col justify-between rounded-2xl border border-[#d7e4ee] bg-white p-5">
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-[#0a2f5b]">{p.name_bn?.trim() || p.name}</h3>
                <PackageCopy description={p.description} features={p.features} />
                <p className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Check className="h-3.5 w-3.5 text-[#1566b8]" />
                  {bn(p.class_count ?? 0)}টি ক্লাস · {durationLabel(p.duration_days)}
                </p>
              </div>
              <div className="mt-4 space-y-3 border-t border-[#eef4f9] pt-3">
                <p className="text-2xl font-extrabold text-[#0a2f5b]">{p.price === 0 ? 'ফ্রি' : formatBdt(p.price)}</p>
                {ownedIds.has(p.id) ? (
                  <p className="text-xs font-bold text-[#156f4d]">ইতোমধ্যে এনরোল করা</p>
                ) : (
                  <Button
                    className="w-full rounded-xl bg-[#1566b8] hover:bg-[#0f5294]"
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
                    এনরোল করুন
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
