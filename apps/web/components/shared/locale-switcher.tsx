'use client';

import { cn } from '@/lib/utils';
import { useCalcLocale } from '@/components/shared/calc-locale-provider';
import type { AppLocale } from '@/i18n/config';

/** Language toggle for Pension / Joining calculators only. */
export function LocaleSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useCalcLocale();

  function switchTo(next: AppLocale) {
    if (next === locale) return;
    setLocale(next);
  }

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-lg border border-border bg-surface p-0.5 text-sm',
        className,
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => switchTo('en')}
        className={cn(
          'rounded-md px-2.5 py-1 font-medium transition-colors',
          locale === 'en'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted hover:text-foreground',
        )}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => switchTo('bn')}
        className={cn(
          'rounded-md px-2.5 py-1 font-medium transition-colors',
          locale === 'bn'
            ? 'bg-primary text-primary-foreground'
            : 'text-muted hover:text-foreground',
        )}
      >
        বাং
      </button>
    </div>
  );
}
