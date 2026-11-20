import { cn } from '@/lib/utils';

/** Mark from the LMS design: blue tile, white A, ProAssist wordmark. */
export function BrandMark({
  tone = 'navy',
  className,
}: {
  tone?: 'navy' | 'white';
  className?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#1566b8] text-lg font-bold leading-none text-white">
        A
      </span>
      <span className={cn('text-base font-bold tracking-tight', tone === 'white' ? 'text-white' : 'text-[#0a2f5b]')}>
        ProAssist
      </span>
    </span>
  );
}
