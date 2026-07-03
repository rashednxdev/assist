'use client';

export type BookContentsViewMode = 'short' | 'full';

const OPTIONS: { value: BookContentsViewMode; label: string }[] = [
  { value: 'short', label: 'Short' },
  { value: 'full', label: 'Full book' },
];

export function BookViewModeToggle({
  value,
  onChange,
}: {
  value: BookContentsViewMode;
  onChange: (mode: BookContentsViewMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Book contents view"
      className="inline-flex shrink-0 rounded-lg border border-amber-900/15 bg-[#fffef8] p-0.5 text-xs font-medium shadow-sm"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`cursor-pointer rounded-md px-2.5 py-1.5 transition-colors sm:px-3 ${
              selected
                ? 'bg-amber-100 text-amber-950 shadow-sm ring-1 ring-amber-900/10'
                : 'text-muted hover:bg-amber-50/80 hover:text-foreground'
            }`}
          >
            <input
              type="radio"
              name="book-contents-view"
              value={opt.value}
              checked={selected}
              className="sr-only"
              onChange={() => onChange(opt.value)}
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
