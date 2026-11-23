import { cn } from '@/lib/utils';

/** ProAssist mark: blue rounded tile, stylized white A with cyan center dot. */
export function BrandMark({
  tone = 'navy',
  className,
  showWordmark = true,
}: {
  tone?: 'navy' | 'white';
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className="relative flex h-9 w-9 items-center justify-center rounded-[10px] bg-[#1566b8] text-[1.35rem] font-extrabold leading-none text-white shadow-sm"
        aria-hidden
      >
        <span className="relative translate-y-px tracking-tight">A</span>
        <span className="absolute left-1/2 top-[52%] h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#7dd3fc]" />
      </span>
      {showWordmark ? (
        <span
          className={cn(
            'text-[1.05rem] font-bold tracking-tight',
            tone === 'white' ? 'text-white' : 'text-[#0a2f5b]',
          )}
        >
          ProAssist
        </span>
      ) : null}
    </span>
  );
}
