import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import multer from 'multer';
import { env } from '../../config/env.js';
import { badRequest } from '../../shared/errors/AppError.js';

const ROOT = path.resolve(env.UPLOAD_DIR ?? path.join(process.cwd(), 'storage'), 'schedule');

export const schedulePdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.SCHEDULE_MAX_FILE_MB * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype !== 'application/pdf' && !file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(new Error('Only PDF files are allowed'));
      return;
    }
    cb(null, true);
  },
});

function eventDir(eventId: string): string {
  if (!/^[a-f\d]{24}$/i.test(eventId)) throw badRequest('Invalid schedule id');
  return path.join(ROOT, eventId);
}

export async function saveSchedulePdf(eventId: string, file: Express.Multer.File) {
  if (file.buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw badRequest('The file is not a valid PDF');
  const id = randomUUID();
  const storedName = `${id}.pdf`;
  const dir = eventDir(eventId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, storedName), file.buffer);
  const name = path.basename(file.originalname).replace(/[^\w.\- ()\u0980-\u09FF]/g, '_').slice(0, 150) || 'document.pdf';
  return { id, name, size: file.size, stored_name: storedName, uploaded_at: new Date() };
}

export function schedulePdfPath(eventId: string, storedName: string): string {
  if (!/^[\w-]+\.pdf$/.test(storedName)) throw badRequest('Invalid file');
  return path.join(eventDir(eventId), storedName);
}

export async function deleteSchedulePdf(eventId: string, storedName: string): Promise<void> {
  await rm(schedulePdfPath(eventId, storedName), { force: true });
}
