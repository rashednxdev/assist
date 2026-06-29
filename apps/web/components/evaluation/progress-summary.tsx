'use client';

interface ProgressSummaryProps {
  percent: number;
  rated: number;
  total: number;
  size?: 'sm' | 'md';
}

export function ProgressSummary({ percent, rated, total, size = 'md' }: ProgressSummaryProps) {
  const barHeight = size === 'sm' ? 'h-1.5' : 'h-2.5';
  const textClass = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className={`font-medium ${textClass}`}>{percent}%</span>
        <span className={`text-muted ${textClass}`}>
          {rated}/{total} rated
        </span>
      </div>
      <div className={`w-full overflow-hidden rounded-full bg-slate-200 ${barHeight}`}>
        <div
          className={`${barHeight} rounded-full bg-primary transition-all`}
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>
    </div>
  );
}
