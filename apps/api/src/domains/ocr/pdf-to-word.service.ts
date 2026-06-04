import { createCanvas } from '@napi-rs/canvas';
import { Document, Packer, PageBreak, Paragraph, TextRun } from 'docx';
import pdfParse from 'pdf-parse';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createWorker, type Worker } from 'tesseract.js';
import { env } from '../../config/env.js';
import { badRequest } from '../../shared/errors/AppError.js';
import { logger } from '../../shared/logger.js';

export interface PdfToWordResult {
  buffer: Buffer;
  filename: string;
  pages: number;
  method: 'text' | 'ocr' | 'mixed';
  languages: string;
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/\.pdf$/i, '').replace(/[^\w.\-() ]+/g, '_').trim() || 'document';
  return `${base}.docx`;
}

function isPdfBuffer(buffer: Buffer): boolean {
  return buffer.length >= 4 && buffer.subarray(0, 4).toString('utf8') === '%PDF';
}

/** Split pdf-parse output into rough pages (form feed) or paragraphs. */
function splitPdfParsePages(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  const byFf = normalized.split('\f').map((p) => p.trim()).filter(Boolean);
  if (byFf.length > 1) return byFf;
  const chunks = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return chunks.length > 0 ? chunks : [normalized];
}

async function extractTextPerPageWithPdfJs(buffer: Buffer): Promise<string[]> {
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    pages.push(text);
  }

  return pages;
}

async function renderPageToPng(page: pdfjs.PDFPageProxy, scale = 2): Promise<Buffer> {
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext('2d');
  await page.render({
    // pdfjs types expect browser CanvasRenderingContext2D; @napi-rs/canvas is compatible at runtime
    canvasContext: context as unknown as Parameters<typeof page.render>[0]['canvasContext'],
    viewport,
  }).promise;
  return canvas.toBuffer('image/png');
}

let ocrWorker: Worker | null = null;

async function getOcrWorker(): Promise<Worker> {
  if (!ocrWorker) {
    ocrWorker = await createWorker(env.OCR_LANGUAGES);
  }
  return ocrWorker;
}

async function ocrPageImage(png: Buffer): Promise<string> {
  const worker = await getOcrWorker();
  const { data } = await worker.recognize(png);
  return data.text.replace(/\s+/g, ' ').trim();
}

async function extractPagesWithOcrFallback(buffer: Buffer): Promise<{ pages: string[]; method: 'text' | 'ocr' | 'mixed' }> {
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  let usedOcr = 0;
  let usedText = 0;

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = content.items
      .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (text.length < env.OCR_MIN_TEXT_CHARS) {
      try {
        const png = await renderPageToPng(page);
        text = await ocrPageImage(png);
        usedOcr++;
      } catch (err) {
        logger.warn({ err, page: i }, 'OCR render failed for page');
        usedText++;
      }
    } else {
      usedText++;
    }

    pages.push(text || `[Page ${i} — no text detected]`);
  }

  const method = usedOcr === 0 ? 'text' : usedText === 0 ? 'ocr' : 'mixed';
  return { pages, method };
}

function pagesToDocx(pages: string[]): Promise<Buffer> {
  const children: Paragraph[] = [];

  pages.forEach((pageText, index) => {
    if (index > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }
    const lines = pageText.split(/\n+/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) {
      children.push(new Paragraph({ children: [new TextRun(' ')] }));
      return;
    }
    for (const line of lines) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: line, size: 24 })],
          spacing: { after: 120 },
        }),
      );
    }
  });

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return Packer.toBuffer(doc);
}

export async function convertPdfToWord(
  fileBuffer: Buffer,
  originalName: string,
): Promise<PdfToWordResult> {
  if (!isPdfBuffer(fileBuffer)) {
    throw badRequest('File is not a valid PDF');
  }

  let pages: string[] = [];
  let method: 'text' | 'ocr' | 'mixed' = 'text';

  try {
    const parsed = await pdfParse(fileBuffer);
    const parsedPages = splitPdfParsePages(parsed.text);
    const totalChars = parsedPages.join('').length;
    const avgPerPage = parsedPages.length > 0 ? totalChars / parsedPages.length : 0;

    if (totalChars >= env.OCR_MIN_TEXT_CHARS * Math.max(parsedPages.length, 1) && avgPerPage >= env.OCR_MIN_TEXT_CHARS) {
      pages = parsedPages;
      method = 'text';
    }
  } catch {
    logger.debug('pdf-parse failed, falling back to pdf.js');
  }

  if (pages.length === 0 || pages.every((p) => p.length < env.OCR_MIN_TEXT_CHARS)) {
    const extracted = await extractPagesWithOcrFallback(fileBuffer);
    pages = extracted.pages;
    method = extracted.method;
  } else if (pages.some((p) => p.length < env.OCR_MIN_TEXT_CHARS)) {
    const extracted = await extractPagesWithOcrFallback(fileBuffer);
    pages = extracted.pages;
    method = extracted.method;
  }

  if (pages.length === 0) {
    const fallback = await extractTextPerPageWithPdfJs(fileBuffer);
    pages = fallback;
    method = 'text';
  }

  if (pages.every((p) => !p.trim())) {
    throw badRequest('No readable text found in this PDF. Try a clearer scan or a text-based PDF.');
  }

  const docxBuffer = await pagesToDocx(pages);

  return {
    buffer: docxBuffer,
    filename: sanitizeFilename(originalName),
    pages: pages.length,
    method,
    languages: env.OCR_LANGUAGES,
  };
}

export async function shutdownOcrWorker(): Promise<void> {
  if (ocrWorker) {
    await ocrWorker.terminate();
    ocrWorker = null;
  }
}
