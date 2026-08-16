import type { ComparisonTable, ProcessStep } from '@/types/questions';
import type { ReaderChapterFull, ReaderTopicFull } from '@/types/books';
import { cleanBookLabel, ruleHeading, subRuleHeading } from '@/lib/book-display';
import { richTextToHtml } from '@/lib/answer-pdf-markup';

export type BookPdfOrientation = 'portrait' | 'landscape';

const FOOTER = 'ProAssist |  SAS/SRAS First Part 2026';

function escapeText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTableHtml(table?: ComparisonTable | null): string {
  if (!table?.columns?.length || !table.rows?.length) return '';
  const cols = [table.feature_header?.trim() || 'Feature', ...table.columns];
  const header = cols.map((c) => `<th>${escapeText(c || '—')}</th>`).join('');
  const rows = table.rows
    .map((row) => {
      const cells = [row.feature, ...(row.values ?? [])].map(
        (v) => `<td>${richTextToHtml(v || '—', 'body')}</td>`,
      );
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');
  const title = table.title?.trim()
    ? `<div class="table-title">${escapeText(table.title.trim())}</div>`
    : '';
  return `<div class="table-wrap">${title}<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderProcessHtml(proc: {
  title?: string;
  details?: string;
  steps?: ProcessStep[];
}): string {
  const title =
    proc.title?.trim() && proc.title.trim().toLowerCase() !== 'process'
      ? `<div class="subsection-title">${escapeText(proc.title.trim())}</div>`
      : '';
  const details = proc.details?.trim() ? richTextToHtml(proc.details, 'body') : '';
  const steps = (proc.steps ?? [])
    .map((step, i) => {
      const role = step.role?.trim()
        ? `<span class="role">${escapeText(step.role.trim())}</span>`
        : '';
      const st = step.title?.trim() ? richTextToHtml(step.title, 'step-title') : '';
      const desc = step.description?.trim() ? richTextToHtml(step.description, 'step-desc') : '';
      return `<div class="process-row"><span class="badge">${i + 1}</span><div>${role}${st}${desc}</div></div>`;
    })
    .join('');
  return `<div class="process">${title}${details}${steps}</div>`;
}

function renderTopicHtml(topic: ReaderTopicFull): string {
  const hasRuleHeading = Boolean(topic.rule_number?.trim() || topic.name?.trim());
  const heading = hasRuleHeading
    ? `<div class="rule-title">${escapeText(ruleHeading(topic))}${topic.is_amended ? ' <span class="amended">Amended</span>' : ''}</div>`
    : '';
  const subName = topic.sub_name?.trim()
    ? `<div class="muted">${escapeText(topic.sub_name.trim())}</div>`
    : '';
  const description = topic.description?.trim() ? richTextToHtml(topic.description, 'body') : '';
  const note = topic.note?.trim() ? `<div class="note">${richTextToHtml(topic.note, 'note')}</div>` : '';
  const table = renderTableHtml(topic.table);
  const processes = (topic.processes ?? []).map(renderProcessHtml).join('');
  const details = (topic.details ?? [])
    .map((d) => (d.detail_text?.trim() ? `<div class="detail">${richTextToHtml(d.detail_text, 'body')}</div>` : ''))
    .join('');
  const subs = (topic.sub_topics ?? [])
    .map((sub) => {
      const hasSub = Boolean(sub.rule_number?.trim() || sub.name?.trim());
      const st = hasSub ? `<div class="sub-title">${escapeText(subRuleHeading(sub))}</div>` : '';
      const sd = sub.description?.trim() ? richTextToHtml(sub.description, 'body') : '';
      const sn = sub.note?.trim() ? `<div class="note">${richTextToHtml(sub.note, 'note')}</div>` : '';
      if (!st && !sd && !sn) return '';
      return `<div class="sub-rule">${st}${sd}${sn}</div>`;
    })
    .join('');
  return `<section class="rule">${heading}${subName}${description}${note}${table}${processes}${details}${subs}</section>`;
}

function renderChapterHtml(chapter: ReaderChapterFull): string {
  const num = cleanBookLabel(chapter.chapter_number);
  const name = cleanBookLabel(chapter.name);
  const titleParts: string[] = [];
  if (num) titleParts.push(`<div class="chapter-title">${escapeText(num)}</div>`);
  if (name) titleParts.push(richTextToHtml(name, 'chapter-title'));
  const title = titleParts.join('');
  const sub = chapter.sub_name?.trim()
    ? `<div class="chapter-sub">${escapeText(chapter.sub_name.trim())}</div>`
    : '';
  const desc = chapter.description?.trim()
    ? `<div class="chapter-desc">${richTextToHtml(chapter.description, 'body')}</div>`
    : '';
  const topics = (chapter.topics ?? []).map(renderTopicHtml).join('');
  return `<section class="chapter">${title}${sub}${desc}${topics}</section>`;
}

function buildCss(fontBase64: string, orientation: BookPdfOrientation): string {
  const margin =
    orientation === 'landscape' ? '0.55in 0.6in 0.6in 0.6in' : '0.7in 0.65in 0.75in 0.65in';
  return `
@font-face {
  font-family: 'Kalpurush';
  src: url(data:font/ttf;base64,${fontBase64}) format('truetype');
  font-weight: normal;
  font-style: normal;
}
* { box-sizing: border-box; }
html, body {
  margin: 0; padding: 0;
  font-family: 'Kalpurush', Georgia, serif;
  color: #111827;
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
@page { margin: ${margin}; }
body { font-size: 12.5px; line-height: 1.55; }
.cover {
  text-align: center;
  margin: 0 0 1.2em;
  padding-bottom: 0.7em;
  border-bottom: 1px solid #d1d5db;
}
.cover h1 {
  font-size: 18px;
  margin: 0 0 0.25em;
  font-weight: 700;
}
.cover .meta { font-size: 10px; color: #6b7280; }
.chapter { margin: 0 0 1.1em; page-break-inside: auto; }
.chapter-title {
  font-size: 14px;
  font-weight: 700;
  margin: 0.9em 0 0.25em;
  color: #0a3d5c;
  page-break-after: avoid;
}
.chapter-sub { font-size: 11px; color: #4b5563; margin-bottom: 0.35em; }
.chapter-desc { margin-bottom: 0.55em; }
.rule { margin: 0.55em 0 0.7em; }
.rule-title {
  font-size: 12.5px;
  font-weight: 700;
  margin: 0 0 0.2em;
  page-break-after: avoid;
}
.amended {
  font-size: 9px;
  font-weight: 700;
  color: #b45309;
  margin-left: 4px;
}
.muted { color: #4b5563; font-size: 11px; margin-bottom: 0.2em; }
.body, .detail, .step-title, .step-desc { text-align: justify; margin: 0 0 0.25em; }
.note { font-size: 10.5px; color: #4b5563; font-style: italic; margin: 0.2em 0; }
.center { text-align: center !important; }
.right-half { margin-left: 50%; text-align: center; }
.split-row { display: flex; justify-content: space-between; gap: 8px; }
.split-left { text-align: left; }
.split-right { text-align: right; }
.blank-line { height: 0.5em; }
.rule-full { border: none; border-top: 1px solid #9ca3af; margin: 0.4em 0; }
.rule-half { border: none; border-top: 1px solid #9ca3af; margin: 0.4em 0 0.4em 50%; width: 50%; }
.sub-rule { margin: 0.35em 0 0.35em 0.7em; }
.sub-title { font-weight: 700; font-size: 11.5px; margin-bottom: 0.15em; }
.table-wrap { margin: 0.35em 0; }
.table-title { text-align: center; font-weight: 700; margin-bottom: 0.2em; font-size: 11px; }
table { width: 100%; border-collapse: collapse; font-size: 10px; }
th, td { border: 1px solid #9ca3af; padding: 3px 5px; vertical-align: top; text-align: left; }
th { background: #f3f4f6; font-weight: 700; }
.process { margin: 0.35em 0; }
.subsection-title { font-weight: 700; margin-bottom: 0.15em; }
.process-row { display: flex; gap: 8px; margin: 0 0 0.3em; align-items: flex-start; }
.badge {
  flex: 0 0 1.25em; width: 1.25em; height: 1.25em; border-radius: 50%;
  border: 1.5px solid #0d9488; color: #0d9488;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px; font-weight: 700;
}
.role { display: block; color: #0f766e; font-weight: 700; font-size: 10px; }
.step-title { font-weight: 700; }
.step-desc { color: #4b5563; font-size: 11px; }
.footer {
  margin-top: 1.1em;
  padding-top: 0.35em;
  border-top: 1px solid #e5e7eb;
  text-align: center;
  font-size: 8.5px;
  color: #6b7280;
}
`;
}

export function bookPdfPagePoints(orientation: BookPdfOrientation): {
  width: number;
  height: number;
} {
  // A4
  if (orientation === 'landscape') return { width: 841.89, height: 595.28 };
  return { width: 595.28, height: 841.89 };
}

export function buildBookPdfHtml(params: {
  bookName: string;
  shortName?: string;
  edition?: string;
  language?: string;
  chapters: ReaderChapterFull[];
  fontBase64: string;
  orientation?: BookPdfOrientation;
}): string {
  const orientation = params.orientation ?? 'portrait';
  const meta = [params.shortName, params.edition ? `Edition ${params.edition}` : '', params.language]
    .filter(Boolean)
    .join(' · ');
  const chaptersHtml = params.chapters.map(renderChapterHtml).join('\n');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${buildCss(params.fontBase64, orientation)}</style>
</head>
<body>
  <header class="cover">
    <h1>${escapeText(params.bookName)}</h1>
    ${meta ? `<div class="meta">${escapeText(meta)}</div>` : ''}
  </header>
  ${chaptersHtml}
  <div class="footer">${escapeText(FOOTER)}</div>
</body>
</html>`;
}

/** @deprecated Use bookPdfPagePoints('portrait') */
export const BOOK_PDF_PAGE = bookPdfPagePoints('portrait');
