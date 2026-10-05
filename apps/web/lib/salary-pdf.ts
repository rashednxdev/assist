const A4_W = 210;
const A4_H = 297;
/** Pages up to this much taller than A4 are shrunk onto one sheet instead of being split. */
const SHRINK_LIMIT = 1.3;

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

/** Renders every `.tr-page` inside `root` as an A4 sheet and downloads them as one PDF. */
export async function downloadFormPdf(root: HTMLElement, fileName: string): Promise<void> {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);
  root.classList.add('tr-capture');
  try {
    await document.fonts.ready;
    const pages = Array.from(root.querySelectorAll<HTMLElement>('.tr-page'));
    if (pages.length === 0) throw new Error('Nothing to download');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
    let first = true;
    for (const page of pages) {
      const dataUrl = await toJpeg(page, { quality: 0.92, pixelRatio: 2, backgroundColor: '#ffffff' });
      const img = await loadImage(dataUrl);
      const height = (img.height * A4_W) / img.width;
      if (height <= A4_H * SHRINK_LIMIT) {
        if (!first) pdf.addPage();
        first = false;
        const scale = Math.min(1, A4_H / height);
        const w = A4_W * scale;
        pdf.addImage(dataUrl, 'JPEG', (A4_W - w) / 2, 0, w, height * scale);
        continue;
      }
      for (let offset = 0; offset < height - 1; offset += A4_H) {
        if (!first) pdf.addPage();
        first = false;
        pdf.addImage(dataUrl, 'JPEG', 0, -offset, A4_W, height);
      }
    }
    pdf.save(fileName);
  } finally {
    root.classList.remove('tr-capture');
  }
}
