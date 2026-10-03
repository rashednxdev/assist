import mongoose from 'mongoose';
import type { CircularDocType } from '@ibas/shared-constants';
import {
  addKnowQuestionsSchema,
  knowCandidatesQuerySchema,
  parseLegacyExplanation,
  serializeExplanationSections,
  setArchiveBookSchema,
  type ArchiveBookItem,
  type ArchiveOverview,
  type KnowCandidate,
  type KnowCircularRef,
  type KnowQuestionItem,
} from '@ibas/shared-types';
import { badRequest, notFound } from '../../shared/errors/AppError.js';
import { escapeRegex } from './text.js';
import { BookChapter } from '../books/models/BookChapter.model.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { BookType } from '../books/models/BookType.model.js';
import { getBookReaderFull } from '../books/books.service.js';
import { Question } from '../questions/models/Question.model.js';
import { QuestionBookLink } from '../questions/models/QuestionBookLink.model.js';
import { QuestionAnswerDetail } from '../questions/models/QuestionAnswerDetail.model.js';
import { Circular } from './models/Circular.model.js';
import { KnowQuestion } from './models/KnowQuestion.model.js';
import { getAreaIndex } from './areas.service.js';

const LIVE_MCQ = { is_active: true, question_type_code: 'MCQ' };

function zodMessage(error: { issues: Array<{ message: string }> }) {
  return error.issues.map((i) => i.message).join('; ');
}

function chapterLabel(c: { chapter_number?: string; name?: string }) {
  const no = c.chapter_number?.trim() ?? '';
  const name = c.name?.trim() ?? '';
  return no && name ? `${no}: ${name}` : no || name;
}

export async function getArchiveOverview(isAdmin: boolean): Promise<ArchiveOverview> {
  const bookFilter: Record<string, unknown> = { is_active: true, archive_book: true };
  if (!isAdmin) bookFilter.is_published = true;
  const [books, types, links, areaIndex] = await Promise.all([
    BookInfo.find(bookFilter).select('name name_bn short_name edition book_type_id is_published').sort({ name: 1 }).lean(),
    BookType.find({}).select('name').lean(),
    KnowQuestion.find({}).select('area_code question_id').lean(),
    getAreaIndex(),
  ]);

  const chapterCounts = books.length
    ? await BookChapter.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
        { $match: { book_info_id: { $in: books.map((b) => b._id) }, is_active: true } },
        { $group: { _id: '$book_info_id', count: { $sum: 1 } } },
      ])
    : [];
  const chapterCount = new Map(chapterCounts.map((c) => [String(c._id), c.count]));
  const typeName = new Map(types.map((t) => [String(t._id), t.name]));

  const questionFilter: Record<string, unknown> = { ...LIVE_MCQ, _id: { $in: links.map((l) => l.question_id) } };
  if (!isAdmin) questionFilter.is_published = true;
  const live = links.length ? new Set((await Question.find(questionFilter).select('_id').lean()).map((q) => String(q._id))) : new Set<string>();
  const perArea = new Map<string, number>();
  for (const l of links) {
    if (live.has(String(l.question_id))) perArea.set(l.area_code, (perArea.get(l.area_code) ?? 0) + 1);
  }

  return {
    books: books.map(
      (b): ArchiveBookItem => ({
        id: String(b._id),
        name: b.name,
        name_bn: b.name_bn,
        short_name: b.short_name || undefined,
        edition: b.edition || undefined,
        book_type_name: typeName.get(String(b.book_type_id)),
        is_published: b.is_published,
        chapter_count: chapterCount.get(String(b._id)) ?? 0,
      }),
    ),
    areas: areaIndex.active
      .map((a) => ({ code: a.code, name_en: a.name_en, name_bn: a.name_bn, color: a.color, question_count: perArea.get(a.code) ?? 0 }))
      .filter((a) => isAdmin || a.question_count > 0),
  };
}

export async function getArchiveBook(bookId: string, isAdmin: boolean) {
  if (!mongoose.isValidObjectId(bookId)) throw notFound('Book not found');
  const book = await BookInfo.findOne({ _id: bookId, is_active: true, archive_book: true }).select('is_published').lean();
  if (!book || (!isAdmin && !book.is_published)) throw notFound('Book not found');
  return getBookReaderFull(bookId);
}

export async function setArchiveBook(bookId: string, body: unknown) {
  if (!mongoose.isValidObjectId(bookId)) throw notFound('Book not found');
  const parsed = setArchiveBookSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const res = await BookInfo.updateOne({ _id: bookId, is_active: true }, { $set: { archive_book: parsed.data.archive } });
  if (res.matchedCount === 0) throw notFound('Book not found');
  return { id: bookId, archive_book: parsed.data.archive };
}

/** First book chapter of each question: its primary chapter, else its first active book link. */
async function chapterOfQuestions(questions: Array<{ _id: mongoose.Types.ObjectId; book_chapter_id?: mongoose.Types.ObjectId }>) {
  const chapterByQuestion = new Map<string, string>();
  const missing: mongoose.Types.ObjectId[] = [];
  for (const q of questions) {
    if (q.book_chapter_id) chapterByQuestion.set(String(q._id), String(q.book_chapter_id));
    else missing.push(q._id);
  }
  if (missing.length) {
    const links = await QuestionBookLink.find({ question_id: { $in: missing }, is_active: true })
      .sort({ sort_order: 1 })
      .select('question_id book_chapter_id')
      .lean();
    for (const l of links) {
      const key = String(l.question_id);
      if (!chapterByQuestion.has(key)) chapterByQuestion.set(key, String(l.book_chapter_id));
    }
  }
  const chapterIds = [...new Set(chapterByQuestion.values())];
  const chapters = chapterIds.length
    ? await BookChapter.find({ _id: { $in: chapterIds }, is_active: true }).select('book_info_id chapter_number name sort_order').lean()
    : [];
  const books = chapters.length
    ? await BookInfo.find({ _id: { $in: [...new Set(chapters.map((c) => String(c.book_info_id)))] }, is_active: true })
        .select('name')
        .lean()
    : [];
  const bookById = new Map(books.map((b) => [String(b._id), b]));
  const chapterById = new Map(chapters.map((c) => [String(c._id), c]));

  return (questionId: string) => {
    const chapterId = chapterByQuestion.get(questionId);
    const chapter = chapterId ? chapterById.get(chapterId) : undefined;
    const book = chapter ? bookById.get(String(chapter.book_info_id)) : undefined;
    if (!chapter || !book) return null;
    return {
      book_id: String(book._id),
      book_name: book.name,
      chapter_id: String(chapter._id),
      chapter_label: chapterLabel(chapter),
      chapter_sort: chapter.sort_order ?? 0,
    };
  };
}

export async function listKnowQuestions(area: string, isAdmin: boolean): Promise<KnowQuestionItem[]> {
  const links = await KnowQuestion.find({ area_code: area }).sort({ sort_order: 1, created_at: 1 }).lean();
  if (links.length === 0) return [];
  const filter: Record<string, unknown> = { ...LIVE_MCQ, _id: { $in: links.map((l) => l.question_id) } };
  if (!isAdmin) filter.is_published = true;
  const questions = await Question.find(filter).select('body_en body_bn book_chapter_id is_published circular_ids').lean();
  if (questions.length === 0) return [];

  const placeOf = await chapterOfQuestions(questions);
  const details = await QuestionAnswerDetail.find({ question_id: { $in: questions.map((q) => q._id) } })
    .select('question_id explanation_sections explanation')
    .lean();
  const detailByQuestion = new Map(details.map((d) => [String(d.question_id), d]));

  const circularIds = [...new Set(questions.flatMap((q) => (q.circular_ids ?? []).map(String)))];
  const circularFilter: Record<string, unknown> = { _id: { $in: circularIds }, is_active: true };
  if (!isAdmin) circularFilter.is_published = true;
  const circulars = circularIds.length
    ? await Circular.find(circularFilter).select('circular_no title title_bn issue_date doc_type').lean()
    : [];
  const circularById = new Map(
    circulars.map((c): [string, KnowCircularRef] => [
      String(c._id),
      {
        id: String(c._id),
        circular_no: c.circular_no,
        title: c.title,
        title_bn: c.title_bn || undefined,
        issue_date: c.issue_date,
        doc_type: c.doc_type as CircularDocType,
      },
    ]),
  );

  const questionById = new Map(questions.map((q) => [String(q._id), q]));
  const rows = links.flatMap((link, order) => {
    const q = questionById.get(String(link.question_id));
    if (!q) return [];
    const id = String(q._id);
    const place = placeOf(id);
    const detail = detailByQuestion.get(id);
    let explanation_sections = serializeExplanationSections(detail?.explanation_sections);
    if (explanation_sections.length === 0 && typeof detail?.explanation === 'string' && detail.explanation.trim()) {
      explanation_sections = parseLegacyExplanation(detail.explanation);
    }
    return [
      {
        order,
        chapter_sort: place?.chapter_sort ?? Number.MAX_SAFE_INTEGER,
        item: {
          link_id: String(link._id),
          id,
          number: 0,
          body_en: q.body_en,
          body_bn: q.body_bn || undefined,
          book_id: place?.book_id,
          book_name: place?.book_name,
          chapter_id: place?.chapter_id,
          chapter_label: place?.chapter_label,
          is_published: q.is_published,
          explanation_sections,
          circulars: (q.circular_ids ?? []).flatMap((cid) => circularById.get(String(cid)) ?? []),
        } satisfies KnowQuestionItem,
      },
    ];
  });

  rows.sort(
    (a, b) =>
      (a.item.book_name ?? '\uffff').localeCompare(b.item.book_name ?? '\uffff') ||
      a.chapter_sort - b.chapter_sort ||
      a.order - b.order,
  );
  return rows.map((r, i) => ({ ...r.item, number: i + 1 }));
}

export async function listKnowCandidates(query: unknown): Promise<KnowCandidate[]> {
  const parsed = knowCandidatesQuerySchema.safeParse(query);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const { area, book_id, chapter_id, q, limit } = parsed.data;

  const filter: Record<string, unknown> = { ...LIVE_MCQ, is_published: true };
  const chapterIds = chapter_id
    ? [new mongoose.Types.ObjectId(chapter_id)]
    : book_id
      ? (await BookChapter.find({ book_info_id: book_id, is_active: true }).select('_id').lean()).map((c) => c._id)
      : null;
  if (chapterIds) {
    if (chapterIds.length === 0) return [];
    const linked = await QuestionBookLink.distinct('question_id', { book_chapter_id: { $in: chapterIds }, is_active: true });
    filter.$or = [{ book_chapter_id: { $in: chapterIds } }, { _id: { $in: linked } }];
  }
  const words = (q ?? '').split(/\s+/).filter(Boolean).slice(0, 8);
  if (words.length) {
    filter.$and = words.map((w) => ({
      $or: [{ body_en: { $regex: escapeRegex(w), $options: 'i' } }, { body_bn: { $regex: escapeRegex(w), $options: 'i' } }],
    }));
  }

  const questions = await Question.find(filter)
    .select('body_en body_bn book_chapter_id circular_ids')
    .sort({ _id: 1 })
    .limit(limit)
    .lean();
  if (questions.length === 0) return [];
  const [placeOf, added] = await Promise.all([
    chapterOfQuestions(questions),
    KnowQuestion.find({ area_code: area, question_id: { $in: questions.map((x) => x._id) } }).select('question_id').lean(),
  ]);
  const addedIds = new Set(added.map((a) => String(a.question_id)));

  return questions.map((x) => {
    const place = placeOf(String(x._id));
    return {
      id: String(x._id),
      body_en: x.body_en,
      body_bn: x.body_bn || undefined,
      book_name: place?.book_name,
      chapter_label: place?.chapter_label,
      circular_count: x.circular_ids?.length ?? 0,
      added: addedIds.has(String(x._id)),
    };
  });
}

export async function addKnowQuestions(body: unknown, userId: string) {
  const parsed = addKnowQuestionsSchema.safeParse(body);
  if (!parsed.success) throw badRequest(zodMessage(parsed.error));
  const { area_code, question_ids } = parsed.data;
  const areaIndex = await getAreaIndex();
  if (!areaIndex.get(area_code)) throw badRequest('Unknown iBAS++ area');

  const valid = await Question.find({ ...LIVE_MCQ, _id: { $in: [...new Set(question_ids)] } }).select('_id').lean();
  if (valid.length === 0) throw badRequest('None of those questions are active MCQs');
  const last = await KnowQuestion.findOne({ area_code }).sort({ sort_order: -1 }).select('sort_order').lean();
  let next = (last?.sort_order ?? -1) + 1;
  const creator = new mongoose.Types.ObjectId(userId);
  const res = await KnowQuestion.bulkWrite(
    valid.map((v) => ({
      updateOne: {
        filter: { area_code, question_id: v._id },
        update: { $setOnInsert: { area_code, question_id: v._id, sort_order: next++, created_by: creator } },
        upsert: true,
      },
    })),
  );
  return { added: res.upsertedCount, skipped: valid.length - res.upsertedCount };
}

export async function removeKnowQuestion(linkId: string) {
  if (!mongoose.isValidObjectId(linkId)) throw notFound('Question link not found');
  const res = await KnowQuestion.deleteOne({ _id: linkId });
  if (res.deletedCount === 0) throw notFound('Question link not found');
  return { ok: true };
}
