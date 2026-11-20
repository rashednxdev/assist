import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { formatBdt, type LiveClassPackageBrief } from '@ibas/shared-types';
import { durationLabel } from '@/lib/billing-format';
import { toBanglaDigits } from '@/lib/bangla-format';

function bn(n: number | string): string {
  return toBanglaDigits(String(n));
}

/** Small "Package" chip for class lists. */
export function LivePackageChip({ packages }: { packages?: LiveClassPackageBrief[] }) {
  if (!packages?.length) return null;
  const owned = packages.some((p) => p.owned);
  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
        owned
          ? 'border-[#bde5d4] bg-[#e8f8ef] text-[#156f4d]'
          : 'border-[#d7e8f8] bg-[#eaf3fc] text-[#1566b8]'
      }`}
    >
      {owned
        ? 'আপনার প্যাকেজে অন্তর্ভুক্ত'
        : packages.length === 1
          ? `প্যাকেজ: ${packages[0]!.name}`
          : `${bn(packages.length)}টি প্যাকেজ`}
    </span>
  );
}

/** Shown on a class page when the user must buy one of the class's packages to join. */
export function LivePackageCta({ packages, message }: { packages?: LiveClassPackageBrief[]; message?: string }) {
  if (!packages?.length) return null;
  return (
    <div className="space-y-3 rounded-2xl border border-[#c7dff4] bg-[#eaf3fc] p-5 text-[#0a2f5b]">
      <div>
        <p className="text-base font-bold">এই ক্লাসটি লাইভ ক্লাস প্যাকেজের অন্তর্ভুক্ত</p>
        <p className="mt-1 text-sm text-slate-600">
          {message ?? 'প্যাকেজে এনরোল করলে এই ক্লাসসহ উক্ত বিষয়ের সব লাইভ ক্লাস ও রেকর্ডিং দেখতে পারবেন।'}
        </p>
      </div>
      <ul className="space-y-2">
        {packages.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#d7e4ee] bg-white px-4 py-2.5 text-sm"
          >
            <span>
              <span className="font-bold text-[#0a2f5b]">{p.name}</span>
              <span className="text-slate-500">
                {' '}
                · {formatBdt(p.price)} · মেয়াদ {durationLabel(p.duration_days)}
              </span>
            </span>
            {p.owned ? (
              <span className="rounded-full bg-[#e8f8ef] px-2.5 py-0.5 text-xs font-bold text-[#156f4d]">
                এনরোল করা
              </span>
            ) : (
              <Link
                href="/packages?tab=live"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1566b8] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#0f5294]"
              >
                <ShoppingBag className="h-3.5 w-3.5" />
                প্যাকেজ কিনুন
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
