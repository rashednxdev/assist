import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import { pdfUpload } from '../../shared/upload.js';
import { ocrInfoHandler, pdfToWordHandler } from './ocr.controller.js';

export const ocrRouter = Router();

ocrRouter.use(authenticate);

ocrRouter.get('/info', asyncHandler(ocrInfoHandler));
ocrRouter.post('/pdf-to-word', pdfUpload.single('pdf'), asyncHandler(pdfToWordHandler));
