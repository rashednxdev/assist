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
      className="inline-flex shrink-0 rounded-lg border border-[#e2e8f0] bg-white p-0.5 text-xs font-medium shadow-sm"
    >
      {OPTIONS.map((opt) => {
        const selected = value === opt.value;
        return (
          <label
            key={opt.value}
            className={`cursor-pointer rounded-md px-2.5 py-1.5 transition-colors sm:px-3 ${
              selected
                ? 'bg-[#0f5c8c] text-white shadow-sm'
                : 'text-[#64748b] hover:bg-[#e8f3fa] hover:text-[#0f172a]'
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
