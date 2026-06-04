import type { Response } from 'express';
import type { AuthRequest } from '../../middleware/auth.js';
import { env } from '../../config/env.js';
import { badRequest } from '../../shared/errors/AppError.js';
import { convertPdfToWord } from './pdf-to-word.service.js';

export async function pdfToWordHandler(req: AuthRequest, res: Response): Promise<void> {
  const file = req.file;
  if (!file?.buffer?.length) {
    throw badRequest('Upload a PDF file in the "pdf" field');
  }

  const result = await convertPdfToWord(file.buffer, file.originalname || 'document.pdf');

  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  );
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(result.filename)}"`);
  res.setHeader('X-Conversion-Pages', String(result.pages));
  res.setHeader('X-Conversion-Method', result.method);
  res.setHeader('X-OCR-Languages', result.languages);
  res.send(result.buffer);
}

export async function ocrInfoHandler(_req: AuthRequest, res: Response): Promise<void> {
  res.json({
    data: {
      formats_in: ['application/pdf'],
      formats_out: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      max_file_mb: env.OCR_MAX_FILE_MB,
      languages: env.OCR_LANGUAGES,
      description: 'Converts PDF to editable Word (.docx). Uses text extraction when possible, OCR for scanned pages.',
    },
  });
}
