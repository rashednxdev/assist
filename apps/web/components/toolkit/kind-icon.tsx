import { BookOpenCheck, ClipboardCheck, FileSignature } from 'lucide-react';
import type { ToolkitKind } from '@ibas/shared-constants';

export const TOOLKIT_KIND_STYLE: Record<ToolkitKind, { icon: typeof ClipboardCheck; className: string }> = {
  checklist: { icon: ClipboardCheck, className: 'bg-emerald-50 text-emerald-700' },
  template: { icon: FileSignature, className: 'bg-violet-50 text-violet-700' },
  guide: { icon: BookOpenCheck, className: 'bg-sky-50 text-sky-700' },
};

export function ToolkitKindIcon({ kind, size = 'md' }: { kind: ToolkitKind; size?: 'sm' | 'md' }) {
  const { icon: Icon, className } = TOOLKIT_KIND_STYLE[kind];
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl ${className} ${size === 'sm' ? 'h-8 w-8' : 'h-11 w-11'}`}
    >
      <Icon className={size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} />
    </div>
  );
}
