import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { formatBdt, type LiveClassPackageBrief } from '@ibas/shared-types';
import { durationLabel } from '@/lib/billing-format';
import { Button } from '@/components/ui/button';

/** Small "Package" chip for class lists. */
export function LivePackageChip({ packages }: { packages?: LiveClassPackageBrief[] }) {
  if (!packages?.length) return null;
  const owned = packages.some((p) => p.owned);
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
        owned ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-violet-200 bg-violet-50 text-violet-800'
      }`}
    >
      {owned ? 'In your package' : packages.length === 1 ? `Package: ${packages[0]!.name}` : `${packages.length} packages`}
    </span>
  );
}

/** Shown on a class page when the user must buy one of the class's packages to join. */
export function LivePackageCta({ packages, message }: { packages?: LiveClassPackageBrief[]; message?: string }) {
  if (!packages?.length) return null;
  return (
    <div className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 text-violet-950">
      <div>
        <p className="text-base font-bold">This class is part of a Live class package</p>
        <p className="mt-1 text-sm opacity-90">
          {message ?? 'Buy the package to join this class and every other class in it.'}
        </p>
      </div>
      <ul className="space-y-2">
        {packages.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white/70 px-3 py-2 text-sm">
            <span>
              <span className="font-semibold">{p.name}</span>
              <span className="text-violet-900/70">
                {' '}
                · {formatBdt(p.price)} · valid {durationLabel(p.duration_days)}
              </span>
            </span>
            {p.owned ? (
              <span className="text-xs font-semibold text-emerald-700">You own this</span>
            ) : (
              <Button asChild size="sm">
                <Link href="/packages?tab=live">
                  <ShoppingBag className="h-4 w-4" />
                  Buy package
                </Link>
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
