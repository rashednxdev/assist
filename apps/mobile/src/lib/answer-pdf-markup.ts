import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';

type LineAlign = 'justify' | 'center' | 'rightHalf' | 'rule' | 'ruleRightHalf';

interface MarkupLine {
  text: string;
  align: LineAlign;
}

/**
 * Strip tags but keep newlines (and turn <br>/<p> into \n) so auto list-marker
 * breaks from insertBookListMarkerLineBreaks survive into PDF HTML.
 * Do NOT collapse all whitespace the way stripHtml() does for previews.
 */
function stripTagsPreserveBreaks(raw?: string | null): string {
  if (!raw?.trim()) return '';
  return String(raw)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function hasBoldMarkup(text: string) {
  return /\*[^*]+\*/.test(text);
}

/** Bold + preserve auto `\n` breaks (same as MarkupText / BookRichText). */
function inlineMarkupHtml(text: string): string {
  if (!hasBoldMarkup(text) && !text.includes('\n')) {
    return escapeHtml(text);
  }

  const parts = text.split(/(\*[^*]+\*)/g);
  return parts
    .map((part) => {
      if (!part) return '';
      const bold = part.match(/^\*([^*]+)\*$/);
      if (bold) {
        const chunks = (bold[1] ?? '').split('\n');
        return `<strong>${chunks.map((c, j) => `${j > 0 ? '<br/>' : ''}${escapeHtml(c)}`).join('')}</strong>`;
      }
      const chunks = part.split('\n');
      return chunks.map((c, j) => `${j > 0 ? '<br/>' : ''}${escapeHtml(c)}`).join('');
    })
    .join('');
}

/**
 * Admin-entered line-break markup — same rules as BookRichText / BOOK_TEXT_MARKUP_HELP:
 * - // → new line (justified); consecutive // → blank lines
 * - /// → centered line
 * - //// → centered in right half
 * - /-- → rule on right half
 * - /--- → full-width rule
 * Longer markers matched first.
 */
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
    // Whitespace-only between markers → blank line on next //
    if (part.trim() === '') continue;
    buffer += part;
  }
  lines.push({ text: buffer.trim(), align });

  while (
    lines.length > 0 &&
    lines[0]!.text.length === 0 &&
    lines[0]!.align !== 'rule' &&
    lines[0]!.align !== 'ruleRightHalf'
  ) {
    lines.shift();
  }
  while (
    lines.length > 0 &&
    lines[lines.length - 1]!.text.length === 0 &&
    lines[lines.length - 1]!.align !== 'rule' &&
    lines[lines.length - 1]!.align !== 'ruleRightHalf'
  ) {
    lines.pop();
  }
  return lines;
}

function renderLineHtml(line: MarkupLine, className: string): string {
  if (line.align === 'rule') return '<hr class="rule-full" />';
  if (line.align === 'ruleRightHalf') return '<hr class="rule-half" />';
  if (!line.text) return '<div class="blank-line"></div>';

  const idx = line.text.indexOf('[]');
  if (idx >= 0) {
    const left = inlineMarkupHtml(line.text.slice(0, idx).trim());
    const right = inlineMarkupHtml(line.text.slice(idx + 2).trim());
    return `<div class="split-row"><span class="split-left">${left}</span><span class="split-right">${right}</span></div>`;
  }

  const cls =
    line.align === 'center'
      ? `${className} center`
      : line.align === 'rightHalf'
        ? `${className} right-half`
        : className;
  return `<div class="${cls}">${inlineMarkupHtml(line.text)}</div>`;
}

/**
 * Convert BookRichText / markup-instruction text to HTML for on-device PDFs.
 * Applies the same auto newline rules (1. 2. / ক. / (ক) / ১।) and // /// //// /-- /--- *bold* [].
 */
export function richTextToHtml(raw?: string | null, className = 'rich'): string {
  const stripped = stripTagsPreserveBreaks(raw);
  if (!stripped) return '';
  const plain = insertBookListMarkerLineBreaks(stripped, '\n');

  const hasSlashMarkup = plain.includes('//') || plain.includes('/--');
  const hasOtherMarkup = plain.includes('[]') || hasBoldMarkup(plain) || plain.includes('\n');

  if (!hasSlashMarkup && !hasOtherMarkup) {
    return `<div class="${className}">${escapeHtml(plain)}</div>`;
  }

  // Match BookRichText / MarkupText: only run // splitter when slash markers exist.
  const lines = hasSlashMarkup
    ? splitMarkupLines(plain)
    : [{ text: plain.trim(), align: 'justify' as const }];

  if (lines.length === 0) {
    const cleaned = plain
      .replace(/\/{2,}/g, '')
      .replace(/\/-{2,}/g, '')
      .replace(/\[\]/g, '')
      .trim();
    return cleaned ? `<div class="${className}">${escapeHtml(cleaned)}</div>` : '';
  }

  // Single justified line with only auto-\n / bold — still expand newlines.
  if (lines.length === 1 && lines[0]!.align === 'justify' && !lines[0]!.text.includes('[]')) {
    const text = lines[0]!.text;
    if (!text.includes('\n') && !hasBoldMarkup(text)) {
      return `<div class="${className}">${escapeHtml(text)}</div>`;
    }
    // Split auto list-marker newlines into block lines (book-like), keep <br/> inside bold spans via inlineMarkupHtml.
    if (text.includes('\n') && !hasBoldMarkup(text)) {
      return text
        .split('\n')
        .map((chunk) =>
          chunk
            ? `<div class="${className}">${escapeHtml(chunk)}</div>`
            : '<div class="blank-line"></div>',
        )
        .join('');
    }
    return `<div class="${className}">${inlineMarkupHtml(text)}</div>`;
  }

  return lines.map((line) => renderLineHtml(line, className)).join('');
}
