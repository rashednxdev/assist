import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Lightweight, safe formatting for community posts: paragraphs, **bold**, `code`,
 * "- " / "1. " lists and bare https:// links. Text is never injected as HTML.
 */

const INLINE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (!part) return null;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-primary underline-offset-2 hover:underline">
          {part}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

type Block = { type: 'p'; lines: string[] } | { type: 'ul' | 'ol'; items: string[] };

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.replace(/\r\n/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    const last = out[out.length - 1];
    if (ul || ol) {
      const type = ul ? 'ul' : 'ol';
      const item = (ul ?? ol)![1]!;
      if (last && last.type === type) last.items.push(item);
      else out.push({ type, items: [item] });
    } else if (!line.trim()) {
      out.push({ type: 'p', lines: [] });
    } else if (last && last.type === 'p' && last.lines.length > 0) {
      last.lines.push(line);
    } else {
      out.push({ type: 'p', lines: [line] });
    }
  }
  return out.filter((b) => (b.type === 'p' ? b.lines.length > 0 : b.items.length > 0));
}

export function PostBody({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn('space-y-3 break-words text-[15px] leading-relaxed text-foreground', className)}>
      {blocks(text).map((b, i) =>
        b.type === 'p' ? (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        ) : b.type === 'ul' ? (
          <ul key={i} className="list-disc space-y-1 pl-6">
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ul>
        ) : (
          <ol key={i} className="list-decimal space-y-1 pl-6">
            {b.items.map((it, j) => (
              <li key={j}>{inline(it)}</li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}
