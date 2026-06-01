import { Router } from 'express';
import { authenticate } from '../../middleware/auth.js';
import { requireAdmin } from '../../middleware/requireAdmin.js';
import { asyncHandler } from '../../shared/asyncHandler.js';
import {
  listBookTypesHandler,
  listBooksHandler,
  getBookHandler,
  getBookTreeHandler,
  getBookChildrenHandler,
  getTopicHandler,
  listChaptersHandler,
  getChapterHandler,
  createBookHandler,
  updateBookHandler,
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
  createAmendmentHandler,
} from './books.controller.js';

export const booksRouter = Router();

booksRouter.use(authenticate);

booksRouter.get('/types', asyncHandler(listBookTypesHandler));
booksRouter.get('/regulations/search', asyncHandler(searchRegulationsHandler));
booksRouter.get('/regulations/:id', asyncHandler(getRegulationHandler));
booksRouter.get('/regulations/:id/amendments', asyncHandler(listAmendmentsHandler));
booksRouter.get('/topics/:topicId', asyncHandler(getTopicHandler));
booksRouter.get('/chapters/:chapterId', asyncHandler(getChapterHandler));
booksRouter.get('/sub-topics/:subTopicId', asyncHandler(getSubTopicHandler));
booksRouter.get('/children', asyncHandler(getBookChildrenHandler));

booksRouter.get('/', asyncHandler(listBooksHandler));
booksRouter.get('/:id/chapters', asyncHandler(listChaptersHandler));
booksRouter.get('/:id/regulations', asyncHandler(listBookRegulationsHandler));
booksRouter.get('/:id', asyncHandler(getBookHandler));
booksRouter.get('/:id/tree', asyncHandler(getBookTreeHandler));

booksRouter.post('/', requireAdmin, asyncHandler(createBookHandler));
booksRouter.post('/regulations', requireAdmin, asyncHandler(createRegulationHandler));
booksRouter.patch('/regulations/:id', requireAdmin, asyncHandler(updateRegulationHandler));
booksRouter.post('/regulations/:id/amendments', requireAdmin, asyncHandler(createAmendmentHandler));
booksRouter.post('/:id/regulations', requireAdmin, asyncHandler(createBookRegulationHandler));
booksRouter.patch('/:id', requireAdmin, asyncHandler(updateBookHandler));
booksRouter.post('/:id/chapters', requireAdmin, asyncHandler(createChapterHandler));
booksRouter.patch('/chapters/:chapterId', requireAdmin, asyncHandler(updateChapterHandler));
booksRouter.delete('/chapters/:chapterId', requireAdmin, asyncHandler(deleteChapterHandler));
booksRouter.post('/chapters/:chapterId/topics', requireAdmin, asyncHandler(createTopicHandler));
booksRouter.patch('/topics/:topicId', requireAdmin, asyncHandler(updateTopicHandler));
booksRouter.delete('/topics/:topicId', requireAdmin, asyncHandler(deleteTopicHandler));
booksRouter.post('/topics/:topicId/sub-topics', requireAdmin, asyncHandler(createSubTopicHandler));
booksRouter.patch('/sub-topics/:subTopicId', requireAdmin, asyncHandler(updateSubTopicHandler));
booksRouter.delete('/sub-topics/:subTopicId', requireAdmin, asyncHandler(deleteSubTopicHandler));
