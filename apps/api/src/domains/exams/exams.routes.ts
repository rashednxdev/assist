import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccess } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listDepartmentsHandler,
  createDepartmentHandler,
  updateDepartmentHandler,
  deleteDepartmentHandler,
  getDepartmentHandler,
  listAuthoritiesHandler,
  createAuthorityHandler,
  updateAuthorityHandler,
  deleteAuthorityHandler,
  getAuthorityHandler,
  listExamNamesHandler,
  getExamNameHandler,
  getExamTreeHandler,
  createExamNameHandler,
  updateExamNameHandler,
  deleteExamNameHandler,
  listExamSessionsHandler,
  getExamSessionHandler,
  createExamSessionHandler,
  updateExamSessionHandler,
  deleteExamSessionHandler,
  listExamPartsHandler,
  createExamPartHandler,
  updateExamPartHandler,
  deleteExamPartHandler,
  getExamPartHandler,
  listExamTypesHandler,
  createExamTypeHandler,
  updateExamTypeHandler,
  deleteExamTypeHandler,
  getExamTypeHandler,
  listExamSubjectsHandler,
  getExamSubjectHandler,
  createExamSubjectHandler,
  updateExamSubjectHandler,
  deleteExamSubjectHandler,
} from './exams.controller.js';

export const examsRouter = Router();

examsRouter.use(authenticate);

examsRouter.get('/departments', requireModuleAccess('EXAM'), asyncHandler(listDepartmentsHandler));
examsRouter.get('/departments/:id', requireModuleAccess('EXAM'), asyncHandler(getDepartmentHandler));
examsRouter.post('/departments', requireAdmin, asyncHandler(createDepartmentHandler));
examsRouter.patch('/departments/:id', requireAdmin, asyncHandler(updateDepartmentHandler));
examsRouter.delete('/departments/:id', requireAdmin, asyncHandler(deleteDepartmentHandler));

examsRouter.get('/authorities', requireModuleAccess('EXAM'), asyncHandler(listAuthoritiesHandler));
examsRouter.get('/authorities/:id', requireModuleAccess('EXAM'), asyncHandler(getAuthorityHandler));
examsRouter.post('/authorities', requireAdmin, asyncHandler(createAuthorityHandler));
examsRouter.patch('/authorities/:id', requireAdmin, asyncHandler(updateAuthorityHandler));
examsRouter.delete('/authorities/:id', requireAdmin, asyncHandler(deleteAuthorityHandler));

examsRouter.get('/names', requireModuleAccess('EXAM'), asyncHandler(listExamNamesHandler));
examsRouter.get('/names/:id', requireModuleAccess('EXAM'), asyncHandler(getExamNameHandler));
examsRouter.get('/names/:id/tree', requireModuleAccess('EXAM'), asyncHandler(getExamTreeHandler));
examsRouter.post('/names', requireAdmin, asyncHandler(createExamNameHandler));
examsRouter.patch('/names/:id', requireAdmin, asyncHandler(updateExamNameHandler));
examsRouter.delete('/names/:id', requireAdmin, asyncHandler(deleteExamNameHandler));

examsRouter.get('/names/:examId/sessions', requireModuleAccess('EXAM'), asyncHandler(listExamSessionsHandler));
examsRouter.get('/sessions/:id', requireModuleAccess('EXAM'), asyncHandler(getExamSessionHandler));
examsRouter.post('/sessions', requireAdmin, asyncHandler(createExamSessionHandler));
examsRouter.patch('/sessions/:id', requireAdmin, asyncHandler(updateExamSessionHandler));
examsRouter.delete('/sessions/:id', requireAdmin, asyncHandler(deleteExamSessionHandler));

examsRouter.get('/names/:examId/parts', requireModuleAccess('EXAM'), asyncHandler(listExamPartsHandler));
examsRouter.get('/parts/:partId/subjects', requireModuleAccess('EXAM'), asyncHandler(listExamSubjectsHandler));
examsRouter.get('/parts/:id', requireModuleAccess('EXAM'), asyncHandler(getExamPartHandler));
examsRouter.post('/parts', requireAdmin, asyncHandler(createExamPartHandler));
examsRouter.patch('/parts/:id', requireAdmin, asyncHandler(updateExamPartHandler));
examsRouter.delete('/parts/:id', requireAdmin, asyncHandler(deleteExamPartHandler));

examsRouter.get('/names/:examId/types', requireModuleAccess('EXAM'), asyncHandler(listExamTypesHandler));
examsRouter.get('/types/:id', requireModuleAccess('EXAM'), asyncHandler(getExamTypeHandler));
examsRouter.post('/types', requireAdmin, asyncHandler(createExamTypeHandler));
examsRouter.patch('/types/:id', requireAdmin, asyncHandler(updateExamTypeHandler));
examsRouter.delete('/types/:id', requireAdmin, asyncHandler(deleteExamTypeHandler));

examsRouter.get('/subjects/:id', requireModuleAccess('EXAM'), asyncHandler(getExamSubjectHandler));
examsRouter.post('/subjects', requireAdmin, asyncHandler(createExamSubjectHandler));
examsRouter.patch('/subjects/:id', requireAdmin, asyncHandler(updateExamSubjectHandler));
examsRouter.delete('/subjects/:id', requireAdmin, asyncHandler(deleteExamSubjectHandler));
