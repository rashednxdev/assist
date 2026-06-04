import multer from 'multer';
import { env } from '../config/env.js';

const maxBytes = env.OCR_MAX_FILE_MB * 1024 * 1024;

export const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});
