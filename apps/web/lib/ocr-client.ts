import { getAccessToken } from './auth';
import { parseJsonResponse } from './parse-json-response';

export interface OcrInfo {
  formats_in: string[];
  formats_out: string[];
  max_file_mb: number;
  languages: string;
  description: string;
}

export async function fetchOcrInfo(): Promise<OcrInfo> {
  const token = getAccessToken();
  const res = await fetch('/api/proxy/v1/ocr/info', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
  });
  const json = await parseJsonResponse<{ data: OcrInfo }>(res);
  if (!res.ok) throw new Error('Failed to load OCR settings');
  return json.data;
}

export interface PdfToWordResult {
  blob: Blob;
  filename: string;
  pages: number;
  method: string;
}

export async function convertPdfToWord(file: File): Promise<PdfToWordResult> {
  const token = getAccessToken();
  const form = new FormData();
  form.append('pdf', file);

  const res = await fetch('/api/proxy/v1/ocr/pdf-to-word', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    credentials: 'include',
    body: form,
  });

  if (!res.ok) {
    const json = await parseJsonResponse<{ error?: { message?: string } }>(res).catch(() => ({
      error: { message: 'Conversion failed' },
    }));
    throw new Error(json.error?.message ?? `Conversion failed (${res.status})`);
  }

  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="?([^"]+)"?/i);
  const filename = match?.[1] ? decodeURIComponent(match[1]) : file.name.replace(/\.pdf$/i, '.docx');

  return {
    blob: await res.blob(),
    filename,
    pages: Number(res.headers.get('X-Conversion-Pages') ?? 0),
    method: res.headers.get('X-Conversion-Method') ?? 'unknown',
  };
}
