import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function resolveFontsDir(): string {
  const candidates = [
    path.resolve(__dirname, '../../../assets/fonts'),
    path.resolve(process.cwd(), 'assets/fonts'),
    path.resolve(process.cwd(), 'apps/api/assets/fonts'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'NotoSansBengali-Regular.ttf'))) return dir;
  }
  throw new Error(`Answer PDF fonts not found. Tried: ${candidates.join(' | ')}`);
}

const FONTS_DIR = resolveFontsDir();
const FONT_BN_REGULAR = path.join(FONTS_DIR, 'NotoSansBengali-Regular.ttf');
const FONT_BN_BOLD = path.join(FONTS_DIR, 'NotoSansBengali-Bold.ttf');
const FONT_LATIN_REGULAR = path.join(FONTS_DIR, 'NotoSans-Regular.ttf');
const FONT_LATIN_BOLD = path.join(FONTS_DIR, 'NotoSans-Bold.ttf');

/** A4 landscape — long side = width, short side = height (297×210 mm). */
const A4 = { width: 841.89, height: 595.28 };
/** Digest / pocket 5″×8″ landscape — 8″ wide × 5″ tall. */
const POCKET = { width: 8 * 72, height: 5 * 72 }; // 576 × 360 pt

const PDF_FOOTER = 'ProAssist |  SAS/SRAS First Part 2026';
const FOOTER_BAND = 18;
const RASTER_SCALE = 2;
const MAX_QUESTIONS = 40;

type QuestionDetail = Awaited<ReturnType<typeof getQuestionById>>;

let canvasFontsReady = false;

function ensureCanvasFonts() {
  if (canvasFontsReady) return;
  GlobalFonts.registerFromPath(FONT_BN_REGULAR, 'NotoBn');
  GlobalFonts.registerFromPath(FONT_BN_BOLD, 'NotoBnBold');
  if (fs.existsSync(FONT_LATIN_REGULAR)) {
    GlobalFonts.registerFromPath(FONT_LATIN_REGULAR, 'NotoLat');
  }
  if (fs.existsSync(FONT_LATIN_BOLD)) {
    GlobalFonts.registerFromPath(FONT_LATIN_BOLD, 'NotoLatBold');
  }
  canvasFontsReady = true;
}

function canvasFont(bold: boolean, fontSizePt: number): string {
  const px = fontSizePt * RASTER_SCALE;
  if (bold) return `${px}px "NotoBnBold", "NotoLatBold", sans-serif`;
  return `${px}px "NotoBn", "NotoLat", sans-serif`;
}

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
  return pageSize === 'pocket' ? POCKET : A4;
}

function fontScale(pageSize: AnswerPdfPageSize) {
  return pageSize === 'pocket' ? 0.65 : 1;
}

function sizes(pageSize: AnswerPdfPageSize) {
  const s = fontScale(pageSize);
  return {
    body: 11 * s,
    meta: 9 * s,
    heading: 12 * s,
    subheading: 10.5 * s,
    table: 8.5 * s,
    margin: pageSize === 'pocket' ? 24 : 36,
  };
}

function wrapLines(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  text: string,
  maxWidthPx: number,
): string[] {
  const out: string[] = [];
  for (const para of text.split('\n')) {
    if (!para) {
      out.push('');
      continue;
    }
    const tokens = para.split(/(\s+)/).filter((t) => t.length > 0);
    let line = '';
    for (const tok of tokens) {
      const trial = line + tok;
      if (!line || ctx.measureText(trial).width <= maxWidthPx) {
        line = trial;
        continue;
      }
      out.push(line);
      // If a single token is wider than the line, hard-break by code units.
      if (ctx.measureText(tok.trimStart()).width > maxWidthPx) {
        let chunk = '';
        for (const ch of tok.trimStart()) {
          const t2 = chunk + ch;
          if (chunk && ctx.measureText(t2).width > maxWidthPx) {
            out.push(chunk);
            chunk = ch;
          } else {
            chunk = t2;
          }
        }
        line = chunk;
      } else {
        line = tok.trimStart();
      }
    }
    if (line) out.push(line);
  }
  return out.length ? out : [''];
}

function lineHeightPt(fontSize: number, lineGap = 2) {
  return fontSize * 1.4 + lineGap;
}

/** Rasterize one line with Skia shaping (readable Bengali + Latin). */
function rasterLine(
  line: string,
  fontSize: number,
  maxWidthPt: number,
  color: string,
  bold: boolean,
): Buffer {
  ensureCanvasFonts();
  const w = Math.max(1, Math.ceil(maxWidthPt * RASTER_SCALE));
  const h = Math.max(1, Math.ceil(lineHeightPt(fontSize) * RASTER_SCALE));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, w, h);
  ctx.font = canvasFont(bold, fontSize);
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  ctx.fillText(line, 0, Math.round(fontSize * RASTER_SCALE * 0.05));
  return canvas.toBuffer('image/png');
}

function measureWrappedHeight(text: string, fontSize: number, maxWidthPt: number, bold: boolean) {
  ensureCanvasFonts();
  const ctx = createCanvas(1, 1).getContext('2d');
  ctx.font = canvasFont(bold, fontSize);
  const lines = wrapLines(ctx, text, maxWidthPt * RASTER_SCALE);
  return lines.length * lineHeightPt(fontSize);
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number, dims: { height: number }, margin: number) {
  if (doc.y + needed > dims.height - margin - FOOTER_BAND) {
    doc.addPage();
    doc.y = margin;
  }
}

function writeShapedText(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: {
    fontSize: number;
    color?: string;
    indent?: number;
    margin: number;
    dims: { width: number; height: number };
    bold?: boolean;
    afterGap?: number;
  },
) {
  const cleaned = stripMarkup(text);
  if (!cleaned) return;

  ensureCanvasFonts();
  const x = opts.margin + (opts.indent ?? 0);
  const maxWidth = opts.dims.width - opts.margin * 2 - (opts.indent ?? 0);
  const color = opts.color ?? '#0f172a';
  const bold = opts.bold === true;
  const ctx = createCanvas(1, 1).getContext('2d');
  ctx.font = canvasFont(bold, opts.fontSize);
  const lines = wrapLines(ctx, cleaned, maxWidth * RASTER_SCALE);
  const lh = lineHeightPt(opts.fontSize);

  for (const line of lines) {
    ensureSpace(doc, lh + 1, opts.dims, opts.margin);
    if (line.length > 0) {
      const png = rasterLine(line, opts.fontSize, maxWidth, color, bold);
      doc.image(png, x, doc.y, { width: maxWidth, height: lh });
    }
    doc.y += lh;
  }
  doc.y += opts.afterGap ?? opts.fontSize * 0.3;
}

function writeParagraph(
  doc: PDFKit.PDFDocument,
  text: string,
  opts: {
    fontSize: number;
    color?: string;
    indent?: number;
    margin: number;
    dims: { width: number; height: number };
  },
) {
  writeShapedText(doc, text, { ...opts, bold: false });
}

function writeHeading(
  doc: PDFKit.PDFDocument,
  text: string,
  fontSize: number,
  margin: number,
  dims: { width: number; height: number },
) {
  writeShapedText(doc, text, {
    fontSize,
    margin,
    dims,
    bold: true,
    afterGap: fontSize * 0.2,
  });
}

function drawFooter(
  doc: PDFKit.PDFDocument,
  dims: { width: number; height: number },
  margin: number,
  pageSize: AnswerPdfPageSize,
) {
  const savedX = doc.x;
  const savedY = doc.y;
  const size = pageSize === 'pocket' ? 7 : 8.5;
  const y = dims.height - Math.max(12, margin * 0.55);
  const width = dims.width - margin * 2;
  ensureCanvasFonts();
  const w = Math.max(1, Math.ceil(width * RASTER_SCALE));
  const h = Math.max(1, Math.ceil(lineHeightPt(size, 0) * RASTER_SCALE));
  const canvas = createCanvas(w, h);
  const ctx = canvas.getContext('2d');
  ctx.font = canvasFont(false, size);
  ctx.fillStyle = '#64748b';
  ctx.textBaseline = 'top';
  const tw = ctx.measureText(PDF_FOOTER).width;
  ctx.fillText(PDF_FOOTER, Math.max(0, (w - tw) / 2), 0);
  doc.image(canvas.toBuffer('image/png'), margin, y, {
    width,
    height: lineHeightPt(size, 0),
  });
  doc.x = savedX;
  doc.y = savedY;
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
  const cellW = colW - pad * 2;

  if (visible.title?.trim()) {
    writeHeading(doc, visible.title, fontSize + 0.5, margin, dims);
  }

  const drawRow = (cells: string[], header: boolean) => {
    const cleaned = cells.map((c) => stripMarkup(c) || '—');
    const heights = cleaned.map((c) => measureWrappedHeight(c, fontSize, cellW, header));
    const rowH = Math.max(fontSize + 6, ...heights) + pad * 2;
    ensureSpace(doc, rowH + 2, dims, margin);
    const y0 = doc.y;
    cleaned.forEach((cell, i) => {
      const x = margin + i * colW;
      if (header) {
        doc.rect(x, y0, colW, rowH).fillColor('#f1f5f9').fill();
      }
      doc.rect(x, y0, colW, rowH).strokeColor('#cbd5e1').lineWidth(0.5).stroke();

      ensureCanvasFonts();
      const ctx = createCanvas(1, 1).getContext('2d');
      ctx.font = canvasFont(header, fontSize);
      const lines = wrapLines(ctx, cell, cellW * RASTER_SCALE);
      const lh = lineHeightPt(fontSize, 1);
      let cy = y0 + pad;
      for (const line of lines) {
        if (line) {
          const png = rasterLine(line, fontSize, cellW, '#0f172a', header);
          doc.image(png, x + pad, cy, { width: cellW, height: lh });
        }
        cy += lh;
      }
    });
    doc.y = y0 + rowH;
  };

  drawRow(cols, true);
  for (const row of visible.rows) {
    drawRow([row.feature, ...row.values.map((v) => v ?? '')], false);
  }
  doc.moveDown(0.35);
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
    try {
      ensureCanvasFonts();
    } catch (err) {
      reject(err);
      return;
    }

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

    doc.on('pageAdded', () => {
      drawFooter(doc, dims, s.margin, pageSize);
    });

    questions.forEach((q, i) => renderQuestion(doc, q, i, questions.length, pageSize));
    drawFooter(doc, dims, s.margin, pageSize);
    doc.end();
  });
}

export async function buildAnswerPdf(params: {
  question_ids: string[];
  page_size: AnswerPdfPageSize;
}): Promise<{ buffer: Buffer; filename: string; count: number }> {
  const pageSize = params.page_size ?? 'a4';
  const unique = [...new Set(params.question_ids)].slice(0, MAX_QUESTIONS);
  if (unique.length === 0) throw badRequest('Select at least one question');

  const questions: QuestionDetail[] = [];
  for (const id of unique) {
    try {
      questions.push(await getQuestionById(id));
    } catch {
      /* skip */
    }
  }
  if (questions.length === 0) throw notFound('No questions found for PDF export');

  const buffer = await buildPdfBuffer(questions, pageSize);
  const stamp = new Date().toISOString().slice(0, 10);
  const sizeTag = pageSize === 'pocket' ? 'digest-5x8' : 'a4';
  const filename =
    questions.length === 1
      ? `answer-${questions[0]!.id.slice(-6)}-${sizeTag}.pdf`
      : `answers-${questions.length}q-${stamp}-${sizeTag}.pdf`;
  return { buffer, filename, count: questions.length };
}
