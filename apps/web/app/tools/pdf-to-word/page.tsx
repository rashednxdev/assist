'use client';

import { useEffect, useState } from 'react';
import { FileUp, ScanText, Download, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { convertPdfToWord, fetchOcrInfo, type OcrInfo } from '@/lib/ocr-client';

export default function PdfToWordPage() {
  const [info, setInfo] = useState<OcrInfo | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ pages: number; method: string; filename: string } | null>(null);

  useEffect(() => {
    fetchOcrInfo().then(setInfo).catch(() => {});
  }, []);

  async function handleConvert(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setError('Choose a PDF file first');
      return;
    }
    setError('');
    setResult(null);
    setBusy(true);
    try {
      const out = await convertPdfToWord(file);
      const url = URL.createObjectURL(out.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = out.filename;
      a.click();
      URL.revokeObjectURL(url);
      setResult({ pages: out.pages, method: out.method, filename: out.filename });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="PDF to Word"
        description="Upload a PDF and download an editable Word (.docx) file. Text-based PDFs convert quickly; scanned pages use OCR (English + Bengali)."
      />

      {info && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary">Max {info.max_file_mb} MB</Badge>
          <Badge variant="outline">Languages: {info.languages}</Badge>
        </div>
      )}

      {error && <Alert variant="error">{error}</Alert>}
      {result && (
        <Alert variant="success">
          Downloaded <strong>{result.filename}</strong> — {result.pages} page(s), method: {result.method}
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanText className="h-5 w-5 text-primary" />
            Convert PDF
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleConvert} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pdf-file">PDF file</Label>
              <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-slate-50/50 p-6">
                <input
                  id="pdf-file"
                  type="file"
                  accept="application/pdf,.pdf"
                  disabled={busy}
                  className="text-sm"
                  onChange={(e) => {
                    const f = e.target.files?.[0] ?? null;
                    setFile(f);
                    setError('');
                    setResult(null);
                  }}
                />
                {file && (
                  <p className="text-sm text-muted">
                    <FileUp className="mr-1 inline h-4 w-4" />
                    {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                  </p>
                )}
              </div>
            </div>

            <ul className="list-inside list-disc space-y-1 text-sm text-muted">
              <li>Digital PDFs: text is copied into Word paragraphs.</li>
              <li>Scanned PDFs: each page is OCR’d (may take longer on large files).</li>
              <li>Complex layouts, tables, and images are not fully preserved.</li>
            </ul>

            <Button type="submit" disabled={busy || !file} className="w-full sm:w-auto">
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Converting…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Convert &amp; download Word
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
