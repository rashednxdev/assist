import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listDepartmentsHandler,
  createDepartmentHandler,
  updateDepartmentHandler,
  getDepartmentHandler,
  listAuthoritiesHandler,
  createAuthorityHandler,
  updateAuthorityHandler,
  getAuthorityHandler,
  listExamNamesHandler,
  getExamNameHandler,
  getExamTreeHandler,
  createExamNameHandler,
  updateExamNameHandler,
  listExamPartsHandler,
  createExamPartHandler,
  updateExamPartHandler,
  getExamPartHandler,
  listExamTypesHandler,
  createExamTypeHandler,
  updateExamTypeHandler,
  getExamTypeHandler,
  listExamSubjectsHandler,
  getExamSubjectHandler,
  createExamSubjectHandler,
  updateExamSubjectHandler,
  deleteExamSubjectHandler,
} from './exams.controller.js';

export const examsRouter = Router();

examsRouter.use(authenticate);

examsRouter.get('/departments', asyncHandler(listDepartmentsHandler));
examsRouter.get('/departments/:id', asyncHandler(getDepartmentHandler));
examsRouter.post('/departments', requireAdmin, asyncHandler(createDepartmentHandler));
examsRouter.patch('/departments/:id', requireAdmin, asyncHandler(updateDepartmentHandler));

examsRouter.get('/authorities', asyncHandler(listAuthoritiesHandler));
examsRouter.get('/authorities/:id', asyncHandler(getAuthorityHandler));
examsRouter.post('/authorities', requireAdmin, asyncHandler(createAuthorityHandler));
examsRouter.patch('/authorities/:id', requireAdmin, asyncHandler(updateAuthorityHandler));

examsRouter.get('/names', asyncHandler(listExamNamesHandler));
examsRouter.get('/names/:id', asyncHandler(getExamNameHandler));
examsRouter.get('/names/:id/tree', asyncHandler(getExamTreeHandler));
examsRouter.post('/names', requireAdmin, asyncHandler(createExamNameHandler));
examsRouter.patch('/names/:id', requireAdmin, asyncHandler(updateExamNameHandler));

examsRouter.get('/names/:examId/parts', asyncHandler(listExamPartsHandler));
examsRouter.get('/parts/:partId/subjects', asyncHandler(listExamSubjectsHandler));
examsRouter.get('/parts/:id', asyncHandler(getExamPartHandler));
examsRouter.post('/parts', requireAdmin, asyncHandler(createExamPartHandler));
examsRouter.patch('/parts/:id', requireAdmin, asyncHandler(updateExamPartHandler));

examsRouter.get('/names/:examId/types', asyncHandler(listExamTypesHandler));
examsRouter.get('/types/:id', asyncHandler(getExamTypeHandler));
examsRouter.post('/types', requireAdmin, asyncHandler(createExamTypeHandler));
examsRouter.patch('/types/:id', requireAdmin, asyncHandler(updateExamTypeHandler));

examsRouter.get('/subjects/:id', asyncHandler(getExamSubjectHandler));
examsRouter.post('/subjects', requireAdmin, asyncHandler(createExamSubjectHandler));
examsRouter.patch('/subjects/:id', requireAdmin, asyncHandler(updateExamSubjectHandler));
examsRouter.delete('/subjects/:id', requireAdmin, asyncHandler(deleteExamSubjectHandler));
