import type { Response } from 'express';
import {
  createBookTypeSchema,
  updateBookTypeSchema,
  createBookSchema,
  updateBookSchema,
  createBookChapterSchema,
  updateBookChapterSchema,
  createBookTopicSchema,
  updateBookTopicSchema,
  createBookSubTopicSchema,
  updateBookSubTopicSchema,
  createRegulationSchema,
  updateRegulationSchema,
  createAmendmentSchema,
  bookTreeQuerySchema,
  bookChildrenQuerySchema,
  regulationSearchSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import * as booksService from './books.service.js';

export async function listBookTypesHandler(_req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.listBookTypes();
  res.json({ data });
}

export async function createBookTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createBookTypeSchema.parse(req.body);
  const data = await booksService.createBookType(dto);
  res.status(201).json({ data });
}

export async function updateBookTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateBookTypeSchema.parse(req.body);
  const data = await booksService.updateBookType(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteBookTypeHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.deleteBookType(String(req.params.id));
  res.json({ data });
}

export async function listBooksHandler(req: AuthRequest, res: Response): Promise<void> {
  const book_type_id = typeof req.query.book_type_id === 'string' ? req.query.book_type_id : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q : undefined;
  const data = await booksService.listBooks({ book_type_id, q });
  res.json({ data });
}

export async function getBookHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.getBookById(String(req.params.id));
  res.json({ data });
}

export async function getBookTreeHandler(req: AuthRequest, res: Response): Promise<void> {
  const { depth } = bookTreeQuerySchema.parse(req.query);
  const data = await booksService.getBookTree(String(req.params.id), depth);
  res.json({ data });
}

export async function getBookChildrenHandler(req: AuthRequest, res: Response): Promise<void> {
  const { type, id } = bookChildrenQuerySchema.parse(req.query);
  const data = await booksService.getBookChildren(type, id);
  res.json({ data });
}

export async function getTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.getTopicDetail(String(req.params.topicId));
  res.json({ data });
}

export async function createBookHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createBookSchema.parse(req.body);
  const data = await booksService.createBook(dto);
  res.status(201).json({ data });
}

export async function updateBookHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateBookSchema.parse(req.body);
  const data = await booksService.updateBook(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteBookHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.deleteBook(String(req.params.id));
  res.json({ data });
}

export async function listChaptersHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.listChapters(String(req.params.id));
  res.json({ data });
}

export async function getChapterHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.getChapterById(String(req.params.chapterId));
  res.json({ data });
}

export async function updateChapterHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateBookChapterSchema.parse(req.body);
  const data = await booksService.updateChapter(String(req.params.chapterId), dto);
  res.json({ data });
}

export async function deleteChapterHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.deleteChapter(String(req.params.chapterId));
  res.json({ data });
}

export async function updateTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateBookTopicSchema.parse(req.body);
  const data = await booksService.updateTopic(String(req.params.topicId), dto);
  res.json({ data });
}

export async function deleteTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.deleteTopic(String(req.params.topicId));
  res.json({ data });
}

export async function getSubTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.getSubTopicById(String(req.params.subTopicId));
  res.json({ data });
}

export async function updateSubTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateBookSubTopicSchema.parse(req.body);
  const data = await booksService.updateSubTopic(String(req.params.subTopicId), dto);
  res.json({ data });
}

export async function deleteSubTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.deleteSubTopic(String(req.params.subTopicId));
  res.json({ data });
}

export async function listBookRegulationsHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.listRegulationsForBook(String(req.params.id));
  res.json({ data });
}

export async function updateRegulationHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateRegulationSchema.parse(req.body);
  const data = await booksService.updateRegulation(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteRegulationHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.deleteRegulation(String(req.params.id));
  res.json({ data });
}

export async function createChapterHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createBookChapterSchema.parse(req.body);
  const data = await booksService.createChapter(String(req.params.id), dto);
  res.status(201).json({ data });
}

export async function createTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createBookTopicSchema.parse(req.body);
  const data = await booksService.createTopic(String(req.params.chapterId), dto);
  res.status(201).json({ data });
}

export async function createSubTopicHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createBookSubTopicSchema.parse(req.body);
  const data = await booksService.createSubTopic(String(req.params.topicId), dto);
  res.status(201).json({ data });
}

export async function searchRegulationsHandler(req: AuthRequest, res: Response): Promise<void> {
  const filters = regulationSearchSchema.parse(req.query);
  const data = await booksService.searchRegulations(filters);
  res.json({ data });
}

export async function getRegulationHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.getRegulationById(String(req.params.id));
  res.json({ data });
}

export async function listAmendmentsHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.listAmendments(String(req.params.id));
  res.json({ data });
}

export async function createRegulationHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createRegulationSchema.parse(req.body);
  const data = await booksService.createRegulation(dto);
  res.status(201).json({ data });
}

export async function createBookRegulationHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createRegulationSchema.parse({
    ...(req.body as object),
    book_info_id: String(req.params.id),
  });
  const data = await booksService.createRegulation(dto);
  res.status(201).json({ data });
}

export async function createAmendmentHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createAmendmentSchema.parse(req.body);
  const data = await booksService.createAmendment(String(req.params.id), dto);
  res.status(201).json({ data });
}
