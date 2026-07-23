import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { requireModuleAccess } from '../../middleware/requireModuleAccess.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listBookTypesHandler,
  createBookTypeHandler,
  updateBookTypeHandler,
  deleteBookTypeHandler,
  listBooksHandler,
  getBookHandler,
  getBookTreeHandler,
  getBookChildrenHandler,
  getTopicHandler,
  listChaptersHandler,
  getBookReaderOutlineHandler,
  getBookReaderFullHandler,
  getChapterHandler,
  listChapterQuestionsHandler,
  listChapterQuestionsManageHandler,
  createBookHandler,
  updateBookHandler,
  deleteBookHandler,
  publishBookHandler,
  unpublishBookHandler,
  createChapterHandler,
  updateChapterHandler,
  deleteChapterHandler,
  createTopicHandler,
  updateTopicHandler,
  deleteTopicHandler,
  getSubTopicHandler,
  createSubTopicHandler,
  updateSubTopicHandler,
  deleteSubTopicHandler,
  searchRegulationsHandler,
  listBookRegulationsHandler,
  getRegulationHandler,
  listAmendmentsHandler,
  createRegulationHandler,
  createBookRegulationHandler,
  updateRegulationHandler,
  deleteRegulationHandler,
  createAmendmentHandler,
} from './books.controller.js';

export const booksRouter = Router();

booksRouter.use(authenticate);

booksRouter.get('/types', requireModuleAccess('BOOKS'), asyncHandler(listBookTypesHandler));
booksRouter.post('/types', requireAdmin, asyncHandler(createBookTypeHandler));
booksRouter.patch('/types/:id', requireAdmin, asyncHandler(updateBookTypeHandler));
booksRouter.delete('/types/:id', requireAdmin, asyncHandler(deleteBookTypeHandler));
booksRouter.get('/regulations/search', requireModuleAccess('BOOKS'), asyncHandler(searchRegulationsHandler));
booksRouter.get('/regulations/:id', requireModuleAccess('BOOKS'), asyncHandler(getRegulationHandler));
booksRouter.get('/regulations/:id/amendments', requireModuleAccess('BOOKS'), asyncHandler(listAmendmentsHandler));
booksRouter.get('/topics/:topicId', requireModuleAccess('BOOKS'), asyncHandler(getTopicHandler));
booksRouter.get('/chapters/:chapterId/questions/manage', requireAdmin, asyncHandler(listChapterQuestionsManageHandler));
booksRouter.get('/chapters/:chapterId/questions', requireModuleAccess('BOOKS'), asyncHandler(listChapterQuestionsHandler));
booksRouter.get('/chapters/:chapterId', requireModuleAccess('BOOKS'), asyncHandler(getChapterHandler));
booksRouter.get('/sub-topics/:subTopicId', requireModuleAccess('BOOKS'), asyncHandler(getSubTopicHandler));
booksRouter.get('/children', requireModuleAccess('BOOKS'), asyncHandler(getBookChildrenHandler));

booksRouter.get('/', requireModuleAccess('BOOKS'), asyncHandler(listBooksHandler));
booksRouter.get('/:id/chapters', requireModuleAccess('BOOKS'), asyncHandler(listChaptersHandler));
booksRouter.get('/:id/reader-outline', requireModuleAccess('BOOKS'), asyncHandler(getBookReaderOutlineHandler));
booksRouter.get('/:id/reader-full', requireModuleAccess('BOOKS'), asyncHandler(getBookReaderFullHandler));
booksRouter.get('/:id/regulations', requireModuleAccess('BOOKS'), asyncHandler(listBookRegulationsHandler));
booksRouter.get('/:id', requireModuleAccess('BOOKS'), asyncHandler(getBookHandler));
booksRouter.get('/:id/tree', requireModuleAccess('BOOKS'), asyncHandler(getBookTreeHandler));

booksRouter.post('/', requireAdmin, asyncHandler(createBookHandler));
booksRouter.post('/regulations', requireAdmin, asyncHandler(createRegulationHandler));
booksRouter.patch('/regulations/:id', requireAdmin, asyncHandler(updateRegulationHandler));
booksRouter.delete('/regulations/:id', requireAdmin, asyncHandler(deleteRegulationHandler));
booksRouter.post('/regulations/:id/amendments', requireAdmin, asyncHandler(createAmendmentHandler));
booksRouter.post('/:id/regulations', requireAdmin, asyncHandler(createBookRegulationHandler));
booksRouter.patch('/:id', requireAdmin, asyncHandler(updateBookHandler));
booksRouter.delete('/:id', requireAdmin, asyncHandler(deleteBookHandler));
booksRouter.post('/:id/publish', requireAdmin, asyncHandler(publishBookHandler));
booksRouter.post('/:id/unpublish', requireAdmin, asyncHandler(unpublishBookHandler));
booksRouter.post('/:id/chapters', requireAdmin, asyncHandler(createChapterHandler));
booksRouter.patch('/chapters/:chapterId', requireAdmin, asyncHandler(updateChapterHandler));
booksRouter.delete('/chapters/:chapterId', requireAdmin, asyncHandler(deleteChapterHandler));
booksRouter.post('/chapters/:chapterId/topics', requireAdmin, asyncHandler(createTopicHandler));
booksRouter.patch('/topics/:topicId', requireAdmin, asyncHandler(updateTopicHandler));
booksRouter.delete('/topics/:topicId', requireAdmin, asyncHandler(deleteTopicHandler));
booksRouter.post('/topics/:topicId/sub-topics', requireAdmin, asyncHandler(createSubTopicHandler));
booksRouter.patch('/sub-topics/:subTopicId', requireAdmin, asyncHandler(updateSubTopicHandler));
booksRouter.delete('/sub-topics/:subTopicId', requireAdmin, asyncHandler(deleteSubTopicHandler));
