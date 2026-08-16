import {
  hasComparisonTableContent,
  hasProcessContent,
  mergeComparisonIntoModelAnswerSections,
  type AnswerPdfPageSize,
  type ComparisonTable as SharedComparisonTable,
} from '@ibas/shared-types';
import type { ExplanationSection, QuestionDetail } from '@/types/questions';
import { bilingualQuestionText } from '@/lib/question-display';
import { richTextToHtml } from '@/lib/answer-pdf-markup';

const FOOTER = 'ProAssist |  SAS/SRAS First Part 2026';

function asSharedTable(
  table?: ExplanationSection['table'] | null,
): SharedComparisonTable | undefined {
  return table as SharedComparisonTable | undefined;
}

/** Page size in points (72 dpi) — portrait. */
export function pdfPagePoints(pageSize: AnswerPdfPageSize): { width: number; height: number } {
  if (pageSize === 'pocket') return { width: 5 * 72, height: 8 * 72 }; // Digest 5″×8″
  return { width: 595.28, height: 841.89 }; // A4
}

function fontScale(pageSize: AnswerPdfPageSize) {
  return pageSize === 'pocket' ? 0.82 : 1;
}

function escapeText(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function sectionHasTable(sec: ExplanationSection) {
  return hasComparisonTableContent(asSharedTable(sec.table));
}

function normalizeSections(sections?: ExplanationSection[]) {
  return (sections ?? []).filter(
    (sec) =>
      Boolean(sec.title?.trim() || sec.content?.trim() || sec.details?.trim() || sec.note?.trim()) ||
      sectionHasTable(sec) ||
      (sec.subsections?.length ?? 0) > 0,
  );
}

function collectProcesses(sections?: ExplanationSection[]) {
  return (sections ?? [])
    .map((sec) => sec.process)
    .filter((process): process is NonNullable<ExplanationSection['process']> =>
      hasProcessContent(process),
    );
}

function renderTableHtml(table: NonNullable<ExplanationSection['table']>): string {
  if (!hasComparisonTableContent(asSharedTable(table))) return '';
  const cols = [table.feature_header?.trim() || 'Feature', ...(table.columns ?? [])];
  const header = cols.map((c) => `<th>${escapeText(c || '—')}</th>`).join('');
  const rows = (table.rows ?? [])
    .map((row) => {
      const cells = [row.feature, ...(row.values ?? [])].map(
        (v) => `<td>${richTextToHtml(v || '—', 'cell-rich')}</td>`,
      );
      return `<tr>${cells.join('')}</tr>`;
    })
    .join('');
  const title = table.title?.trim()
    ? `<div class="table-title">${escapeText(table.title.trim())}</div>`
    : '';
  return `<div class="table-wrap">${title}<table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function renderProcessHtml(proc: NonNullable<ExplanationSection['process']>): string {
  const title =
    proc.title?.trim() && proc.title.trim().toLowerCase() !== 'process'
      ? `<div class="subsection-title">${escapeText(proc.title.trim())}</div>`
      : '';
  const details = proc.details?.trim() ? richTextToHtml(proc.details, 'body') : '';
  const steps = (proc.steps ?? [])
    .map((step, i) => {
      const role = step.role?.trim()
        ? `<span class="role-pill">${escapeText(step.role.trim())}</span>`
        : '';
      const st = step.title?.trim() ? richTextToHtml(step.title, 'step-title') : '';
      const desc = step.description?.trim() ? richTextToHtml(step.description, 'step-desc') : '';
      return `<div class="process-row"><div class="badge">${i + 1}</div><div class="process-body">${role}${st}${desc}</div></div>`;
    })
    .join('');
  return `<div class="process-group">${title}${details}${steps}</div>`;
}

function renderSectionHtml(sec: ExplanationSection): string {
  const title = sec.title?.trim()
    ? `<div class="section-heading">${escapeText(sec.title.trim())}</div>`
    : '';
  const content = sec.content?.trim() ? richTextToHtml(sec.content, 'body') : '';
  const details = sec.details?.trim() ? richTextToHtml(sec.details, 'body') : '';
  const note = sec.note?.trim()
    ? `<div class="note">${richTextToHtml(sec.note, 'note-inner')}</div>`
    : '';
  const table = sectionHasTable(sec) && sec.table ? renderTableHtml(sec.table) : '';
  const subs = (sec.subsections ?? [])
    .map((sub) => {
      const st = sub.subtitle?.trim()
        ? `<div class="subsection-title">${escapeText(sub.subtitle.trim())}</div>`
        : '';
      const sd = sub.details?.trim() ? richTextToHtml(sub.details, 'body') : '';
      const sn = sub.note?.trim()
        ? `<div class="note">${richTextToHtml(sub.note, 'note-inner')}</div>`
        : '';
      if (!st && !sd && !sn) return '';
      return `<div class="subsection">${st}${sd}${sn}</div>`;
    })
    .join('');
  if (!title && !content && !details && !note && !table && !subs) return '';
  return `<div class="section-block">${title}${content}${details}${note}${table}${subs}</div>`;
}

function renderQuestionHtml(q: QuestionDetail, index: number, total: number, isLast: boolean): string {
  const modelSections = normalizeSections(
    mergeComparisonIntoModelAnswerSections(
      q.model_answer_sections as never,
      asSharedTable(q.model_answer_comparison),
    ) as ExplanationSection[],
  );
  const explanationSections = normalizeSections(q.explanation_sections);
  const allProcesses = [
    ...collectProcesses(q.model_answer_sections),
    ...collectProcesses(q.explanation_sections),
  ];
  const hasNestedComparison = modelSections.some(sectionHasTable);
  const hasLegacyComparison =
    hasComparisonTableContent(asSharedTable(q.model_answer_comparison)) && !hasNestedComparison;

  const metaBits = [
    q.question_type_name || q.question_type_code,
    q.book_name,
    q.chapter_name
      ? q.chapter_number
        ? `${q.chapter_number}: ${q.chapter_name}`
        : q.chapter_name
      : null,
  ].filter(Boolean);

  // Same as the reading screen: one stem line when EN/BN match; secondary only when different.
  const stemText = bilingualQuestionText(q.body_en, q.body_bn);
  const stemHtml = [
    stemText.primary ? richTextToHtml(stemText.primary, 'stem') : '',
    stemText.secondary ? richTextToHtml(stemText.secondary, 'stem secondary') : '',
  ]
    .filter(Boolean)
    .join('');

  let options = '';
  if (q.has_options && (q.options?.length ?? 0) > 0) {
    const rows = (q.options ?? [])
      .map((opt) => {
        const mark = opt.is_correct ? ' correct' : '';
        const line =
          opt.option_text_en?.trim() || opt.option_text_bn?.trim() || '';
        const text = richTextToHtml(
          `${opt.option_key.toUpperCase()}. ${line}${opt.is_correct ? ' ✓' : ''}`,
          'option-text',
        );
        return `<div class="option${mark}">${text}</div>`;
      })
      .join('');
    options = `<div class="block"><div class="label">Options</div>${rows}</div>`;
  }

  const legacyTable =
    hasLegacyComparison && q.model_answer_comparison
      ? `<div class="block">${renderTableHtml(q.model_answer_comparison)}</div>`
      : '';

  const modelPanel = modelSections.length
    ? `<div class="block"><div class="label">উত্তর</div>${modelSections.map(renderSectionHtml).join('')}</div>`
    : '';

  const expPanel = explanationSections.length
    ? `<div class="block"><div class="label">Explanation</div>${explanationSections.map(renderSectionHtml).join('')}</div>`
    : '';

  const notePanel = q.note?.trim()
    ? `<div class="block"><div class="label">Note</div>${richTextToHtml(q.note, 'body')}</div>`
    : '';

  const processPanel = allProcesses.length
    ? `<div class="block">${allProcesses.map(renderProcessHtml).join('')}</div>`
    : '';

  const breakClass = isLast ? '' : ' break-after';

  return `
<article class="question${breakClass}">
  <div class="meta">${total > 1 ? `প্রশ্ন ${index + 1}/${total}` : 'প্রশ্ন'}${metaBits.length ? ` · ${escapeText(metaBits.join(' · '))}` : ''}</div>
  <div class="stem-block">${stemHtml}</div>
  ${options}
  ${legacyTable}
  ${modelPanel}
  ${expPanel}
  ${notePanel}
  ${processPanel}
  <div class="footer">${escapeText(FOOTER)}</div>
</article>`;
}

function buildCss(pageSize: AnswerPdfPageSize, fontBase64: string): string {
  const s = fontScale(pageSize);
  // Book-like type scale (denser than the app card UI).
  const body = Math.round(12.5 * s * 10) / 10;
  const meta = Math.round(9.5 * s * 10) / 10;
  const heading = Math.round(12.5 * s * 10) / 10;
  const label = Math.round(11 * s * 10) / 10;
  // Standard book content margins (~0.6–0.75").
  const margin = pageSize === 'pocket' ? '0.45in 0.4in 0.5in 0.4in' : '0.7in 0.65in 0.75in 0.65in';

  return `
@font-face {
  font-family: 'Kalpurush';
  src: url(data:font/ttf;base64,${fontBase64}) format('truetype');
  font-weight: normal;
  font-style: normal;
}
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  font-family: 'Kalpurush', Georgia, serif;
  color: #111827;
  background: #ffffff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
@page {
  margin: ${margin};
  size: auto;
}
body {
  font-size: ${body}px;
  line-height: 1.55;
}
.question {
  page-break-inside: auto;
}
.question.break-after {
  page-break-after: always;
  break-after: page;
}
.meta {
  font-size: ${meta}px;
  color: #6b7280;
  margin: 0 0 0.35em;
}
.stem-block {
  margin: 0 0 0.85em;
  padding-bottom: 0.55em;
  border-bottom: 1px solid #d1d5db;
}
.stem, .body, .option-text, .cell-rich, .step-title, .step-desc, .note-inner {
  text-align: justify;
  margin: 0 0 0.25em;
}
.stem.secondary { color: #374151; margin-top: 0.2em; }
.center { text-align: center !important; }
.right-half { margin-left: 50%; text-align: center; }
.split-row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  margin: 0.15em 0;
}
.split-left { text-align: left; }
.split-right { text-align: right; }
.blank-line { height: 0.55em; }
.rule-full { border: none; border-top: 1px solid #9ca3af; margin: 0.45em 0; }
.rule-half { border: none; border-top: 1px solid #9ca3af; margin: 0.45em 0 0.45em 50%; width: 50%; }
.block { margin: 0.65em 0 0; }
.label {
  font-size: ${label}px;
  font-weight: 700;
  color: #0f5c8c;
  margin: 0 0 0.35em;
}
.option {
  padding: 0.2em 0;
  margin: 0;
  border: none;
  border-bottom: 1px dotted #e5e7eb;
}
.option.correct { font-weight: 700; }
.section-block { margin: 0 0 0.55em; }
.section-heading {
  font-size: ${heading}px;
  font-weight: 700;
  margin: 0 0 0.2em;
}
.subsection { margin: 0.35em 0 0.35em 0.6em; }
.subsection-title {
  font-size: ${label}px;
  font-weight: 700;
  margin: 0 0 0.15em;
}
.note, .note-inner {
  font-size: ${meta}px;
  color: #4b5563;
  font-style: italic;
}
.table-wrap { margin: 0.35em 0; }
.table-title {
  text-align: center;
  font-weight: 700;
  margin-bottom: 0.25em;
  font-size: ${label}px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: ${meta}px;
}
th, td {
  border: 1px solid #9ca3af;
  padding: 3px 5px;
  vertical-align: top;
  text-align: left;
}
th { background: #f3f4f6; font-weight: 700; }
.process-group { margin: 0.35em 0; }
.process-row {
  display: flex;
  gap: 8px;
  margin: 0 0 0.35em;
  align-items: flex-start;
}
.badge {
  flex: 0 0 1.35em;
  width: 1.35em; height: 1.35em;
  border-radius: 50%;
  border: 1.5px solid #0d9488;
  color: #0d9488;
  display: flex; align-items: center; justify-content: center;
  font-size: ${meta}px; font-weight: 700;
  line-height: 1;
}
.process-body { flex: 1; min-width: 0; }
.role-pill {
  display: inline-block;
  color: #0f766e;
  font-size: ${meta}px;
  font-weight: 700;
  margin-bottom: 0.1em;
}
.step-title { font-weight: 700; }
.step-desc { color: #4b5563; font-size: ${meta}px; }
.footer {
  margin-top: 1em;
  padding-top: 0.35em;
  border-top: 1px solid #e5e7eb;
  text-align: center;
  font-size: ${Math.round(8.5 * s * 10) / 10}px;
  color: #6b7280;
}
`;
}

/** Full HTML document — portrait, book-like content density, matches reading stem rules. */
export function buildAnswerPdfHtml(params: {
  questions: QuestionDetail[];
  pageSize: AnswerPdfPageSize;
  fontBase64: string;
}): string {
  const { questions, pageSize, fontBase64 } = params;
  const body = questions
    .map((q, i) => renderQuestionHtml(q, i, questions.length, i === questions.length - 1))
    .join('\n');
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>${buildCss(pageSize, fontBase64)}</style>
</head>
<body>
${body}
</body>
</html>`;
}
