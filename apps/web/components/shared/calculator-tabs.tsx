import Link from 'next/link';
import { Calculator } from 'lucide-react';

export type CalculatorTabId = 'salary' | 'pension' | 'joining';

const TABS: Array<{ id: CalculatorTabId; label: string; href: string }> = [
  { id: 'salary', label: 'বেতন ও বকেয়া বিল', href: '/salary' },
  { id: 'pension', label: 'পেনশন ও গ্র্যাচুইটি', href: '/pension' },
  { id: 'joining', label: 'যোগদানকাল', href: '/joining-period' },
];

/** PDF Page 20 top calculator switcher (keeps all underlying calculator logic intact). */
export function CalculatorTabs({ active }: { active: CalculatorTabId }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d7e4ee] bg-white px-4 py-3 shadow-xs">
      <div className="flex items-center gap-2 text-sm font-bold text-[#0a2f5b]">
        <Calculator className="h-4 w-4 text-[#1566b8]" />
        <span>চাকরি ক্যালকুলেটর</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <Link
              key={tab.id}
              href={tab.href}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                isActive
                  ? 'bg-[#1566b8] text-white shadow-xs'
                  : 'bg-[#f4f9fd] text-[#0a2f5b] hover:bg-[#e5f0fb]'
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
