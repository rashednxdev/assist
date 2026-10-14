const A4_W = 210;
const A4_H = 297;
const LEGAL_LONG = 355.6;
const LEGAL_SHORT = 215.9;
/** Pages up to this much taller than their sheet are shrunk onto one sheet instead of being split. */
const SHRINK_LIMIT = 1.3;
const FOOTER_LABEL = 'Calculate By: ';
const FOOTER_SITE = 'www.proassistbd.com';
const FOOTER_URL = 'https://www.proassistbd.com';
const FOOTER_GREEN: [number, number, number] = [21, 128, 61];

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
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  root.classList.add('tr-capture');
  try {
    await document.fonts.ready;
    const pages = Array.from(root.querySelectorAll<HTMLElement>('.tr-page'));
    if (pages.length === 0) throw new Error('Nothing to download');
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
    const addFooter = (sheet: Sheet) => {
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(...FOOTER_GREEN);
      const x = (sheet.w - pdf.getTextWidth(FOOTER_LABEL + FOOTER_SITE)) / 2;
      const y = sheet.h - 3.5;
      pdf.text(FOOTER_LABEL, x, y);
      pdf.textWithLink(FOOTER_SITE, x + pdf.getTextWidth(FOOTER_LABEL), y, { url: FOOTER_URL });
    };
    for (const page of pages) {
      const sheet = sheetOf(page);
      const dataUrl = await toJpeg(page, { quality: 0.92, pixelRatio: 2, backgroundColor: '#ffffff' });
      const img = await loadImage(dataUrl);
      const height = (img.height * sheet.w) / img.width;
      if (height <= sheet.h * SHRINK_LIMIT) {
        addSheet(sheet);
        const scale = Math.min(1, sheet.h / height);
        const w = sheet.w * scale;
        pdf.addImage(dataUrl, 'JPEG', (sheet.w - w) / 2, 0, w, height * scale);
        addFooter(sheet);
        continue;
      }
      for (let offset = 0; offset < height - 1; offset += sheet.h) {
        addSheet(sheet);
        pdf.addImage(dataUrl, 'JPEG', 0, -offset, sheet.w, height);
        addFooter(sheet);
      }
    }
    pdf.save(fileName);
  } finally {
    root.classList.remove('tr-capture');
  }
}
