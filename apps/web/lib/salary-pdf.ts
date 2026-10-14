const A4_W = 210;
const A4_H = 297;
const LEGAL_LONG = 355.6;
const LEGAL_SHORT = 215.9;
/** Pages up to this much taller than their sheet (any height for `.tr-fit`) are shrunk onto one sheet instead of being split. */
const SHRINK_LIMIT = 1.3;
/** Must match the `.salary-tr-form` font in globals.css. */
const FORM_FONT = 'Nikosh';
/** Largest enlargement of a `.tr-autofit` page's content. */
const FIT_MAX = 1.4;
/** Single-line parts that must not start wrapping when a page's content is enlarged. */
const FIT_KEEP_LINES =
  'tr, .tr-head-line, .tr-fields > div, .tr-p2-row, .tr-page-no, .tr-attach-kicker, .tr-attach-title, .tr-attach-head, .tr-p2-heading';

interface Sheet {
  w: number;
  h: number;
  orientation: 'portrait' | 'landscape';
}

/** `.tr-legal-l` pages print on Legal landscape; every other page on A4 portrait. */
function sheetOf(page: HTMLElement): Sheet {
  return page.classList.contains('tr-legal-l')
    ? { w: LEGAL_LONG, h: LEGAL_SHORT, orientation: 'landscape' }
    : { w: A4_W, h: A4_H, orientation: 'portrait' };
}

/**
 * Enlarges a `.tr-autofit` page's `.tr-fit-body` as far as it fits the sheet, narrowing it by the same factor
 * so the scaled content keeps the page width. Pages already taller than the sheet are left alone.
 * Returns a callback that restores the page.
 */
function fitPage(page: HTMLElement, sheet: Sheet): () => void {
  const body = page.querySelector<HTMLElement>(':scope > .tr-fit-body');
  if (!body || !page.classList.contains('tr-autofit')) return () => {};
  const style = getComputedStyle(page);
  const innerW = page.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
  const availH =
    (page.clientWidth * sheet.h) / sheet.w - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom);
  if (body.offsetHeight >= availH) return () => {};
  const watched = Array.from(body.querySelectorAll<HTMLElement>(FIT_KEEP_LINES));
  const baseHeights = watched.map((el) => el.offsetHeight);
  const reset = () => {
    body.style.width = '';
    body.style.transform = '';
    body.style.transformOrigin = '';
  };
  const fits = (k: number) => {
    body.style.width = `${innerW / k}px`;
    return body.offsetHeight * k <= availH && watched.every((el, i) => el.offsetHeight <= baseHeights[i]! + 1);
  };
  let lo = 1;
  let hi = FIT_MAX;
  if (fits(hi)) lo = hi;
  else {
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      if (fits(mid)) lo = mid;
      else hi = mid;
    }
  }
  body.style.width = `${innerW / lo}px`;
  body.style.transform = `scale(${lo})`;
  body.style.transformOrigin = 'top left';
  return reset;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not render the form'));
    img.src = src;
  });
}

export function pdfFileName(...parts: string[]): string {
  const name = parts
    .join(' ')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return `${name || 'document'}.pdf`;
}

/** Renders every `.tr-page` inside `root` onto its own sheet and downloads them as one PDF. */
export async function downloadFormPdf(root: HTMLElement, fileName: string): Promise<void> {
  const [{ toJpeg, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  root.classList.add('tr-capture');
  try {
    // A font that fails to load falls back to the next family instead of blocking the download.
    await Promise.all([
      document.fonts.load(`16px ${FORM_FONT}`, 'অ১'),
      document.fonts.load(`bold 16px ${FORM_FONT}`, 'অ১'),
    ]).catch(() => undefined);
    await document.fonts.ready;
    const pages = Array.from(root.querySelectorAll<HTMLElement>('.tr-page'));
    if (pages.length === 0) throw new Error('Nothing to download');
    const fontEmbedCSS = await getFontEmbedCSS(root).catch(() => '');
    const firstSheet = sheetOf(pages[0]!);
    const pdf = new jsPDF({
      unit: 'mm',
      format: [firstSheet.w, firstSheet.h],
      orientation: firstSheet.orientation,
      compress: true,
    });
    let first = true;
    const addSheet = (sheet: Sheet) => {
      if (!first) pdf.addPage([sheet.w, sheet.h], sheet.orientation);
      first = false;
    };
    /** Places link areas over the annexure footer's links, which are flattened into the image. */
    const linkOwnFooter = (page: HTMLElement, footer: HTMLElement, x0: number, y0: number, mmPerPx: number) => {
      const base = page.getBoundingClientRect();
      footer.querySelectorAll<HTMLAnchorElement>('a[href]').forEach((a) => {
        const r = a.getBoundingClientRect();
        pdf.link(x0 + (r.left - base.left) * mmPerPx, y0 + (r.top - base.top) * mmPerPx, r.width * mmPerPx, r.height * mmPerPx, {
          url: a.href,
        });
      });
    };
    for (const page of pages) {
      const sheet = sheetOf(page);
      const ownFooter = page.querySelector<HTMLElement>('.tr-attach-footer');
      const resetFit = fitPage(page, sheet);
      const dataUrl = await toJpeg(page, { quality: 0.92, pixelRatio: 2, backgroundColor: '#ffffff', fontEmbedCSS }).finally(
        resetFit,
      );
      const img = await loadImage(dataUrl);
      const height = (img.height * sheet.w) / img.width;
      if (height <= sheet.h * SHRINK_LIMIT || page.classList.contains('tr-fit')) {
        addSheet(sheet);
        const scale = Math.min(1, sheet.h / height);
        const w = sheet.w * scale;
        pdf.addImage(dataUrl, 'JPEG', (sheet.w - w) / 2, 0, w, height * scale);
        if (ownFooter) linkOwnFooter(page, ownFooter, (sheet.w - w) / 2, 0, w / page.offsetWidth);
        continue;
      }
      for (let offset = 0; offset < height - 1; offset += sheet.h) {
        addSheet(sheet);
        pdf.addImage(dataUrl, 'JPEG', 0, -offset, sheet.w, height);
        if (ownFooter && offset + sheet.h >= height - 1) linkOwnFooter(page, ownFooter, 0, -offset, sheet.w / page.offsetWidth);
      }
    }
    pdf.save(fileName);
  } finally {
    root.classList.remove('tr-capture');
  }
}
