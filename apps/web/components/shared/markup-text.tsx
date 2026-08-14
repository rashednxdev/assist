import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';

type LineAlign = 'justify' | 'center' | 'rightHalf' | 'rule' | 'ruleRightHalf';

interface MarkupLine {
  text: string;
  align: LineAlign;
}

function splitMarkupLines(text: string): MarkupLine[] {
  const parts = text.split(/(\/{4}|\/{3}|\/---|\/--|\/{2})/);
  const lines: MarkupLine[] = [];
  let buffer = '';
  let align: LineAlign = 'justify';

  for (const part of parts) {
    if (part === '////' || part === '///' || part === '/---' || part === '/--' || part === '//') {
      lines.push({ text: buffer.trim(), align });
      buffer = '';
      if (part === '/---') {
        lines.push({ text: '', align: 'rule' });
        align = 'justify';
      } else if (part === '/--') {
        lines.push({ text: '', align: 'ruleRightHalf' });
        align = 'justify';
      } else if (part === '////') {
        align = 'rightHalf';
      } else if (part === '///') {
        align = 'center';
      } else {
        align = 'justify';
      }
      continue;
    }
    if (part.trim() === '') continue;
    buffer += part;
  }
  lines.push({ text: buffer.trim(), align });

  while (lines.length > 0) {
    const first = lines[0];
    if (!first || first.text.length > 0 || first.align === 'rule' || first.align === 'ruleRightHalf') {
      break;
    }
    lines.shift();
  }
  while (lines.length > 0) {
    const last = lines[lines.length - 1];
    if (!last || last.text.length > 0 || last.align === 'rule' || last.align === 'ruleRightHalf') {
      break;
    }
    lines.pop();
  }
  return lines;
}

function splitBracketSides(text: string): { left: string; right: string } | null {
  const idx = text.indexOf('[]');
  if (idx < 0) return null;
  return {
    left: text.slice(0, idx).trim(),
    right: text.slice(idx + 2).trim(),
  };
}

function hasBoldMarkup(text: string) {
  return /\*[^*]+\*/.test(text);
}

function InlineMarkup({ text }: { text: string }) {
  if (!hasBoldMarkup(text)) return <>{text}</>;
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <>
      {parts.map((part, i) => {
        const bold = part.match(/^\*([^*]+)\*$/);
        if (bold) {
          // Preserve list-marker newlines that were inserted inside a bold span.
          const boldText = bold[1] ?? '';
          const chunks = boldText.split('\n');
          return (
            <strong key={i}>
              {chunks.map((chunk, j) => (
                <span key={j}>
                  {j > 0 ? <br /> : null}
                  {chunk}
                </span>
              ))}
            </strong>
          );
        }
        if (!part) return null;
        const chunks = part.split('\n');
        return (
          <span key={i}>
            {chunks.map((chunk, j) => (
              <span key={j}>
                {j > 0 ? <br /> : null}
                {chunk}
              </span>
            ))}
          </span>
        );
      })}
    </>
  );
}

function LineContent({ line }: { line: MarkupLine }) {
  if (line.align === 'rule') {
    return <hr className="my-2.5 w-full border-0 border-t-2 border-foreground" />;
  }
  if (line.align === 'ruleRightHalf') {
    return <hr className="my-2.5 ml-auto w-1/2 border-0 border-t-2 border-foreground" />;
  }
  if (!line.text) return <div className="h-6" />;

  const sides = splitBracketSides(line.text);
  if (sides) {
    return (
      <div className="flex w-full items-start gap-1.5">
        <span className="min-w-0 flex-1 text-left">
          <InlineMarkup text={sides.left} />
        </span>
        <span className="min-w-0 flex-1 text-right">
          <InlineMarkup text={sides.right} />
        </span>
      </div>
    );
  }

  const alignClass =
    line.align === 'center'
      ? 'text-center'
      : line.align === 'rightHalf'
        ? 'ml-auto w-1/2 text-center'
        : 'text-justify';

  return (
    <div className={alignClass}>
      <InlineMarkup text={line.text} />
    </div>
  );
}

/** Renders question/book plain text with the same markup as mobile BookRichText. */
export function MarkupText({
  text,
  className = '',
}: {
  text?: string | null;
  className?: string;
}) {
  if (!text?.trim()) return null;
  const plain = insertBookListMarkerLineBreaks(text.trim(), '\n');

  const needsMarkup =
    plain.includes('//') ||
    plain.includes('/--') ||
    plain.includes('[]') ||
    hasBoldMarkup(plain);

  if (!needsMarkup) {
    return <span className={`whitespace-pre-wrap ${className}`.trim()}>{plain}</span>;
  }

  const lines =
    plain.includes('//') || plain.includes('/--')
      ? splitMarkupLines(plain)
      : [{ text: plain.trim(), align: 'justify' as const }];

  if (lines.length === 0) {
    return (
      <span className={className}>
        {plain.replace(/\/{2,}/g, '').replace(/\/-{2,}/g, '').replace(/\[\]/g, '').trim()}
      </span>
    );
  }

  const only = lines.length === 1 ? lines[0] : undefined;
  if (only && only.align === 'justify' && !only.text.includes('[]')) {
    return (
      <span className={`whitespace-pre-wrap ${className}`.trim()}>
        <InlineMarkup text={only.text} />
      </span>
    );
  }

  return (
    <div className={`space-y-0 leading-relaxed ${className}`.trim()}>
      {lines.map((line, i) => (
        <LineContent key={i} line={line} />
      ))}
    </div>
  );
}
