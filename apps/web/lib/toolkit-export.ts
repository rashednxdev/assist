const DOC_CSS = `
  body { font-family: 'Nikosh', 'SutonnyMJ', 'Kalpurush', 'Times New Roman', serif; font-size: 12pt; line-height: 1.5; color: #000; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #555; padding: 4pt 6pt; vertical-align: top; text-align: left; }
  th { background: #f1f5f9; }
  p { margin: 0 0 8pt; }
`;

function escapeTitle(title: string) {
  return title.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!);
}

export function standaloneHtml(title: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${escapeTitle(title)}</title><style>${DOC_CSS}</style></head><body>${bodyHtml}</body></html>`;
}

function safeFileName(title: string) {
  return title.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80) || 'document';
}

/** Word opens HTML saved with a .doc extension, keeping tables and Bangla text editable. */
export function downloadWordDocument(title: string, bodyHtml: string) {
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${escapeTitle(title)}</title><style>${DOC_CSS}</style></head><body>${bodyHtml}</body></html>`;
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeFileName(title)}.doc`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printHtml(title: string, bodyHtml: string) {
  const w = window.open('', '_blank', 'width=900,height=1000');
  if (!w) return false;
  w.document.open();
  w.document.write(standaloneHtml(title, bodyHtml));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 300);
  return true;
}

/** Copies as rich text (pastes formatted into Word / Google Docs) with a plain-text fallback. */
export async function copyRichText(bodyHtml: string) {
  const tmp = document.createElement('div');
  tmp.innerHTML = bodyHtml;
  const plain = tmp.innerText;
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([standaloneHtml('', bodyHtml)], { type: 'text/html' }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      }),
    ]);
    return;
  }
  await navigator.clipboard.writeText(plain);
}
