'use client';

import { cn } from '@/lib/utils';
import type { SalaryLocale } from '@/lib/salary-i18n';

/** EN / বাং switch in the same light style as the other learner pages. */
export function SalaryLocaleToggle({
  value,
  onChange,
  className,
}: {
  value: SalaryLocale;
  onChange: (v: SalaryLocale) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-xl border border-[#d7e4ee] bg-white p-0.5 text-xs print:hidden',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      {(['en', 'bn'] as const).map((loc) => (
        <button
          key={loc}
          type="button"
          onClick={() => onChange(loc)}
          aria-pressed={value === loc}
          className={cn(
            'rounded-lg px-3 py-1.5 font-semibold transition-colors',
            value === loc ? 'bg-[#0a2f5b] text-white' : 'text-[#0a2f5b] hover:bg-[#f4f9fd]',
          )}
        >
          {loc === 'en' ? 'EN' : 'বাং'}
        </button>
      ))}
    </div>
  );
}
