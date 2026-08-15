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
  createProcessSchema,
  updateProcessSchema,
  bookSubjectLinkInputSchema,
  updateBookSubjectLinkSchema,
} from '@ibas/shared-types';
import type { AuthRequest } from '../../middleware/auth.js';
import { getExamSubjectScopeForAuthUser } from '../users/subject-access.service.js';
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
  const exam_subject_id =
    typeof req.query.exam_subject_id === 'string' ? req.query.exam_subject_id : undefined;
  const user = req.user;
  const isAdmin =
    Boolean(user?.is_super_admin) ||
    user?.user_type === 'system_admin' ||
    user?.user_type === 'admin';
  const subjectScope = await getExamSubjectScopeForAuthUser(user);
  // Non-admins (e.g. mobile Book library) only ever see published books, scoped to their subjects.
  const data = await booksService.listBooks(
    { book_type_id, q, exam_subject_id, ...(isAdmin ? {} : { is_published: true }) },
    { subjectScope },
  );
  res.json({ data });
}

export async function listBookSubjectCatalogHandler(req: AuthRequest, res: Response): Promise<void> {
  const subjectScope = await getExamSubjectScopeForAuthUser(req.user);
  const data = await booksService.listBookSubjectCatalog(subjectScope);
  res.json({ data });
}

export async function listBookSubjectLinksHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.listBookSubjectLinks(String(req.params.id));
  res.json({ data });
}

export async function addBookSubjectLinkHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = bookSubjectLinkInputSchema.parse(req.body);
  const data = await booksService.addBookSubjectLink(String(req.params.id), dto);
  res.status(201).json({ data });
}

export async function updateBookSubjectLinkHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateBookSubjectLinkSchema.parse(req.body);
  const data = await booksService.updateBookSubjectLinkSort(
    String(req.params.id),
    String(req.params.examSubjectId),
    dto,
  );
  res.json({ data });
}

export async function removeBookSubjectLinkHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.removeBookSubjectLink(
    String(req.params.id),
    String(req.params.examSubjectId),
  );
  res.json({ data });
}

export async function publishBookHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.publishBook(String(req.params.id));
  res.json({ data });
}

export async function unpublishBookHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.unpublishBook(String(req.params.id));
  res.json({ data });
}

export async function getBookHandler(req: AuthRequest, res: Response): Promise<void> {
  const user = req.user;
  const isAdmin =
    Boolean(user?.is_super_admin) ||
    user?.user_type === 'system_admin' ||
    user?.user_type === 'admin';
  const subjectScope = await getExamSubjectScopeForAuthUser(user);
  const data = await booksService.getBookById(String(req.params.id), {
    subjectScope,
    requirePublished: !isAdmin,
  });
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

export async function getBookReaderOutlineHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.getBookReaderOutline(String(req.params.id));
  res.json({ data });
}

export async function getBookReaderFullHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.getBookReaderFull(String(req.params.id));
  res.json({ data });
}

export async function getChapterHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.getChapterById(String(req.params.chapterId));
  res.json({ data });
}

export async function listChapterQuestionsHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.listChapterQuestions(String(req.params.chapterId));
  res.json({ data });
}

export async function listChapterQuestionsManageHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.listChapterQuestionsForManage(String(req.params.chapterId));
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

export async function createProcessHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = createProcessSchema.parse(req.body);
  const data = await booksService.createProcess(String(req.params.topicId), dto);
  res.status(201).json({ data });
}

export async function updateProcessHandler(req: AuthRequest, res: Response): Promise<void> {
  const dto = updateProcessSchema.parse(req.body);
  const data = await booksService.updateProcess(String(req.params.id), dto);
  res.json({ data });
}

export async function deleteProcessHandler(req: AuthRequest, res: Response): Promise<void> {
  const data = await booksService.deleteProcess(String(req.params.id));
  res.json({ data });
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
