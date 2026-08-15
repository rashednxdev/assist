import PDFDocument from 'pdfkit';
import {
  hasComparisonTableContent,
  hasProcessContent,
  mergeComparisonIntoModelAnswerSections,
  visibleComparisonTable,
  type ComparisonTable,
  type ExplanationSection,
  type AnswerPdfPageSize,
} from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { getQuestionById } from './questions.service.js';

const A4 = { width: 595.28, height: 841.89 };
/** Half of A4 height (portrait cut) — same width as A4. */
const HALF_A4 = { width: 595.28, height: 420.94 };

const MAX_QUESTIONS = 40;

type QuestionDetail = Awaited<ReturnType<typeof getQuestionById>>;

function stripMarkup(raw?: string | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&#160;/gi, ' ')
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
    .replace(/\/{4}|\/{3}|\/---|\/--/g, '\n')
    .replace(/\/{2}/g, '\n')
    .replace(/\[\]/g, '  ')
    .replace(/[\u00a0\u200b\ufeff]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function pageDims(pageSize: AnswerPdfPageSize) {
  return pageSize === 'half_a4' ? HALF_A4 : A4;
}

function fontScale(pageSize: AnswerPdfPageSize) {
  // Standard on A4; 35% reduced on half-A4.
  return pageSize === 'half_a4' ? 0.65 : 1;
}

function sizes(pageSize: AnswerPdfPageSize) {
  const s = fontScale(pageSize);
  return {
    title: 13 * s,
    body: 11 * s,
    meta: 9 * s,
    heading: 12 * s,
    subheading: 10.5 * s,
    table: 8.5 * s,
    margin: pageSize === 'half_a4' ? 28 : 40,
  };
}

async function collectQuestions(ids: string[]): Promise<QuestionDetail[]> {
  const unique = [...new Set(ids)].slice(0, MAX_QUESTIONS);
  if (unique.length === 0) throw badRequest('Select at least one question');
  const out: QuestionDetail[] = [];
  for (const id of unique) {
    try {
      out.push(await getQuestionById(id));
    } catch {
      // Skip missing / inaccessible ids in a batch so one bad id doesn't fail the set.
    }
  }
  if (out.length === 0) throw notFound('No questions found for PDF export');
  return out;
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, dims: { height: number }, margin: number) {
  if (doc.y + needed > dims.height - margin) {
    doc.addPage();
    doc.y = margin;
  }
}

function writeParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: { fontSize: number; color?: string; indent?: number; margin: number; dims: { width: number; height: number } },
) {
  const cleaned = stripMarkup(text);
  if (!cleaned) return;
  const x = opts.margin + (opts.indent ?? 0);
  const width = opts.dims.width - opts.margin * 2 - (opts.indent ?? 0);
  ensureSpace(doc, opts.fontSize * 2.2, opts.dims, opts.margin);
  doc
    .font('Helvetica')
    .fontSize(opts.fontSize)
    .fillColor(opts.color ?? '#0f172a')
    .text(cleaned, x, doc.y, { width, align: 'justify', lineGap: 2 });
  doc.moveDown(0.35);
}

function writeHeading(
  doc: PDFKit.PDFDocument,
  text: string,
  fontSize: number,
  margin: number,
  dims: { width: number; height: number },
) {
  const cleaned = stripMarkup(text);
  if (!cleaned) return;
  ensureSpace(doc, fontSize * 2.4, dims, margin);
  doc
    .font('Helvetica-Bold')
    .fontSize(fontSize)
    .fillColor('#0f172a')
    .text(cleaned, margin, doc.y, { width: dims.width - margin * 2 });
  doc.moveDown(0.25);
}

function drawTable(
  doc: PDFKit.PDFDocument,
  table: ComparisonTable,
  fontSize: number,
  margin: number,
  dims: { width: number; height: number },
) {
  const visible = visibleComparisonTable(table);
  if (!visible) return;

  const cols = [visible.feature_header || 'Feature', ...visible.columns];
  const colCount = cols.length;
  const usable = dims.width - margin * 2;
  const colW = usable / colCount;
  const pad = 3;

  if (visible.title?.trim()) {
    writeHeading(doc, visible.title, fontSize + 0.5, margin, dims);
  }

  const drawRow = (cells: string[], header: boolean) => {
    const heights = cells.map((c) =>
      doc.heightOfString(stripMarkup(c) || '—', { width: colW - pad * 2, align: 'left' }),
    );
    const rowH = Math.max(fontSize + 6, ...heights) + pad * 2;
    ensureSpace(doc, rowH + 2, dims, margin);
    const y0 = doc.y;
    cells.forEach((cell, i) => {
      const x = margin + i * colW;
      doc.rect(x, y0, colW, rowH).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      if (header) {
        doc.rect(x, y0, colW, rowH).fillColor('#f1f5f9').fill();
        doc.rect(x, y0, colW, rowH).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      }
      doc
        .font(header ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(fontSize)
        .fillColor('#0f172a')
        .text(stripMarkup(cell) || '—', x + pad, y0 + pad, {
          width: colW - pad * 2,
          align: 'left',
        });
    });
    doc.y = y0 + rowH;
  };

  drawRow(cols, true);
  for (const row of visible.rows) {
    drawRow([row.feature, ...row.values.map((v) => v ?? '')], false);
  }
  doc.moveDown(0.4);
}

function writeSections(
  doc: PDFKit.PDFDocument,
  sections: ExplanationSection[],
  label: string,
  s: ReturnType<typeof sizes>,
  dims: { width: number; height: number },
) {
  if (!sections.length) return;
  writeHeading(doc, label, s.heading, s.margin, dims);
  for (const sec of sections) {
    if (sec.title?.trim()) writeHeading(doc, sec.title, s.subheading, s.margin, dims);
    if (sec.details?.trim() || (sec as { content?: string }).content?.trim()) {
      writeParagraph(doc, sec.details || (sec as { content?: string }).content || '', {
        fontSize: s.body,
        margin: s.margin,
        dims,
      });
    }
    if (sec.note?.trim()) {
      writeParagraph(doc, `Note: ${sec.note}`, {
        fontSize: s.meta,
        color: '#64748b',
        margin: s.margin,
        dims,
      });
    }
    if (hasComparisonTableContent(sec.table) && sec.table) {
      drawTable(doc, sec.table, s.table, s.margin, dims);
    }
    for (const sub of sec.subsections ?? []) {
      if (sub.subtitle?.trim()) writeHeading(doc, sub.subtitle, s.meta + 1, s.margin, dims);
      if (sub.details?.trim()) {
        writeParagraph(doc, sub.details, { fontSize: s.body, indent: 8, margin: s.margin, dims });
      }
      if (sub.note?.trim()) {
        writeParagraph(doc, `Note: ${sub.note}`, {
          fontSize: s.meta,
          color: '#64748b',
          indent: 8,
          margin: s.margin,
          dims,
        });
      }
    }
    if (hasProcessContent(sec.process) && sec.process) {
      writeHeading(doc, sec.process.title?.trim() || 'Process', s.subheading, s.margin, dims);
      if (sec.process.details?.trim()) {
        writeParagraph(doc, sec.process.details, { fontSize: s.body, margin: s.margin, dims });
      }
      (sec.process.steps ?? []).forEach((step, i) => {
        const line = [step.role?.trim(), step.title?.trim(), step.description?.trim()]
          .filter(Boolean)
          .join(' — ');
        if (line) {
          writeParagraph(doc, `${i + 1}. ${line}`, { fontSize: s.body, margin: s.margin, dims });
        }
      });
    }
  }
}

function renderQuestion(
  doc: PDFKit.PDFDocument,
  q: QuestionDetail,
  index: number,
  total: number,
  pageSize: AnswerPdfPageSize,
) {
  const dims = pageDims(pageSize);
  const s = sizes(pageSize);

  if (index > 0) {
    doc.addPage();
    doc.y = s.margin;
  }

  writeParagraph(doc, `Question ${index + 1} of ${total}`, {
    fontSize: s.meta,
    color: '#64748b',
    margin: s.margin,
    dims,
  });
  writeParagraph(doc, `${q.question_type_code}${q.book_name ? ` · ${q.book_name}` : ''}`, {
    fontSize: s.meta,
    color: '#64748b',
    margin: s.margin,
    dims,
  });

  writeHeading(doc, 'Question', s.heading, s.margin, dims);
  writeParagraph(doc, q.body_en, { fontSize: s.body, margin: s.margin, dims });
  if (q.body_bn?.trim()) {
    writeParagraph(doc, q.body_bn, { fontSize: s.body, margin: s.margin, dims });
  }

  if (q.has_options && (q.options?.length ?? 0) > 0) {
    writeHeading(doc, 'Options', s.heading, s.margin, dims);
    for (const opt of q.options ?? []) {
      const mark = opt.is_correct ? ' ✓' : '';
      writeParagraph(doc, `${opt.option_key.toUpperCase()}. ${opt.option_text_en}${mark}`, {
        fontSize: s.body,
        margin: s.margin,
        dims,
      });
      if (opt.option_text_bn?.trim()) {
        writeParagraph(doc, opt.option_text_bn, {
          fontSize: s.meta,
          color: '#475569',
          indent: 12,
          margin: s.margin,
          dims,
        });
      }
    }
  }

  if (q.has_options) {
    writeSections(doc, q.explanation_sections ?? [], 'Explanation', s, dims);
  } else {
    const modelSections = mergeComparisonIntoModelAnswerSections(
      q.model_answer_sections,
      q.model_answer_comparison,
    );
    writeSections(doc, modelSections, 'Model answer', s, dims);
  }

  if (q.note?.trim()) {
    writeHeading(doc, 'Note', s.heading, s.margin, dims);
    writeParagraph(doc, q.note, { fontSize: s.body, margin: s.margin, dims });
  }
}

function buildPdfBuffer(
  questions: QuestionDetail[],
  pageSize: AnswerPdfPageSize,
): Promise<Buffer> {
  const dims = pageDims(pageSize);
  const s = sizes(pageSize);

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [dims.width, dims.height],
      margins: { top: s.margin, bottom: s.margin, left: s.margin, right: s.margin },
      info: {
        Title: 'ProAssist answer export',
        Author: 'ProAssist',
      },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (c) => chunks.push(c as Buffer));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    questions.forEach((q, i) => renderQuestion(doc, q, i, questions.length, pageSize));
    doc.end();
  });
}

export async function buildAnswerPdf(params: {
  question_ids: string[];
  page_size: AnswerPdfPageSize;
}): Promise<{ buffer: Buffer; filename: string; count: number }> {
  const pageSize = params.page_size ?? 'a4';
  const questions = await collectQuestions(params.question_ids);
  const buffer = await buildPdfBuffer(questions, pageSize);
  const stamp = new Date().toISOString().slice(0, 10);
  const sizeTag = pageSize === 'half_a4' ? 'half-a4' : 'a4';
  const filename =
    questions.length === 1
      ? `answer-${questions[0]!.id.slice(-6)}-${sizeTag}.pdf`
      : `answers-${questions.length}q-${stamp}-${sizeTag}.pdf`;
  return { buffer, filename, count: questions.length };
}
