import mongoose from 'mongoose';
import type {
  CreateBookTypeDto,
  UpdateBookTypeDto,
  CreateBookDto,
  UpdateBookDto,
  CreateBookChapterDto,
  UpdateBookChapterDto,
  CreateBookTopicDto,
  UpdateBookTopicDto,
  CreateBookSubTopicDto,
  UpdateBookSubTopicDto,
  CreateRegulationDto,
  UpdateRegulationDto,
  CreateAmendmentDto,
  CreateProcessDto,
  UpdateProcessDto,
} from '@ibas/shared-types';
import { BookType } from './models/BookType.model.js';
import { BookInfo } from './models/BookInfo.model.js';
import { BookPart } from './models/BookPart.model.js';
import { BookChapter } from './models/BookChapter.model.js';
import { BookTopic } from './models/BookTopic.model.js';
import { BookTopicDetail } from './models/BookTopicDetail.model.js';
import { BookSubTopic } from './models/BookSubTopic.model.js';
import { BookSubTopicDetail } from './models/BookSubTopicDetail.model.js';
import { Regulation } from './models/Regulation.model.js';
import { RegulationAmendment } from './models/RegulationAmendment.model.js';
import { Process } from './models/Process.model.js';
import { Question } from '../questions/models/Question.model.js';
import { QuestionBookLink } from '../questions/models/QuestionBookLink.model.js';
import { QuestionType } from '../questions/models/QuestionType.model.js';
import { cachedBooksList } from '../content-cache/content-cache.service.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';
import { cleanComparisonTable } from '@ibas/shared-types';

function idStr(v: mongoose.Types.ObjectId | string | undefined) {
  return v ? String(v) : undefined;
}

function serializeBookType(doc: InstanceType<typeof BookType>) {
  return {
    id: String(doc._id),
    name: doc.name,
    name_bn: doc.name_bn,
    code: doc.code,
    description: doc.description,
    icon: doc.icon,
    sort_order: doc.sort_order,
  };
}

function serializeBook(doc: InstanceType<typeof BookInfo>, typeName?: string) {
  return {
    id: String(doc._id),
    book_type_id: String(doc.book_type_id),
    book_type_name: typeName,
    name: doc.name,
    name_bn: doc.name_bn,
    short_name: doc.short_name,
    description: doc.description,
    edition: doc.edition,
    publish_date: doc.publish_date,
    published_by: doc.published_by,
    effective_date: doc.effective_date,
    is_part: doc.is_part,
    language: doc.language,
    is_active: doc.is_active,
    is_superseded: doc.is_superseded,
    is_published: doc.is_published,
    tags: doc.tags,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

function serializeRegulation(doc: InstanceType<typeof Regulation>) {
  return {
    id: String(doc._id),
    book_info_id: String(doc.book_info_id),
    book_chapter_id: idStr(doc.book_chapter_id),
    book_topic_id: idStr(doc.book_topic_id),
    regulation_no: doc.regulation_no,
    title: doc.title,
    full_text: doc.full_text,
    regulation_type: doc.regulation_type,
    effective_date: doc.effective_date,
    is_active: doc.is_active,
    is_amended: doc.is_amended,
    applicable_to: doc.applicable_to,
    payment_related: doc.payment_related,
    receipt_related: doc.receipt_related,
    tags: doc.tags,
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };
}

async function loadTopicsForChapter(chapterId: string, depth: number) {
  const topics = await BookTopic.find({ book_chapter_id: chapterId, is_active: true }).sort({ sort_order: 1 });
  if (depth <= 1) {
    return topics.map((t) => ({
      type: 'topic' as const,
      id: String(t._id),
      name: t.name,
      rule_number: t.rule_number,
      is_amended: t.is_amended,
      has_children: true,
    }));
  }

  return Promise.all(
    topics.map(async (t) => {
      const [subTopics, details] = await Promise.all([
        BookSubTopic.find({ book_topic_id: t._id, is_active: true }).sort({ sort_order: 1 }),
        BookTopicDetail.find({ book_topic_id: t._id, is_active: true }).sort({ sort_order: 1 }),
      ]);
      return {
        type: 'topic' as const,
        id: String(t._id),
        name: t.name,
        sub_name: t.sub_name,
        rule_number: t.rule_number,
        description: t.description,
        note: t.note,
        table: t.table,
        is_amended: t.is_amended,
        details: details.map((d) => ({ id: String(d._id), detail_text: d.detail_text, sort_order: d.sort_order })),
        children: subTopics.map((st) => ({
          type: 'sub_topic' as const,
          id: String(st._id),
          name: st.name,
          rule_number: st.rule_number,
          description: st.description,
          note: st.note,
        })),
      };
    }),
  );
}

async function loadChaptersForBook(bookId: string, partId: string | null, depth: number) {
  const filter: Record<string, unknown> = { book_info_id: bookId, is_active: true };
  if (partId) filter.book_parts_id = partId;

  const chapters = await BookChapter.find(filter).sort({ sort_order: 1 });
  return Promise.all(
    chapters.map(async (c) => ({
      type: 'chapter' as const,
      id: String(c._id),
      name: c.name,
      sub_name: c.sub_name,
      chapter_number: c.chapter_number,
      description: c.description,
      children: depth > 1 ? await loadTopicsForChapter(String(c._id), depth - 1) : [],
      has_children: true,
    })),
  );
}

export async function listBookTypes() {
  const items = await BookType.find({ is_active: true }).sort({ sort_order: 1 });
  return items.map(serializeBookType);
}

export async function createBookType(dto: CreateBookTypeDto) {
  const code = dto.code.toUpperCase();
  const existing = await BookType.findOne({ code });
  if (existing) throw badRequest(`Book type code "${code}" already exists`);

  const last = await BookType.findOne().sort({ sort_order: -1 }).select('sort_order');
  const sort_order = dto.sort_order ?? (last ? last.sort_order + 1 : 1);

  const doc = await BookType.create({
    name: dto.name.trim(),
    name_bn: dto.name_bn.trim(),
    code,
    description: dto.description?.trim(),
    notes: dto.notes?.trim(),
    icon: dto.icon?.trim(),
    sort_order,
    is_active: true,
  });
  return serializeBookType(doc);
}

export async function updateBookType(id: string, dto: UpdateBookTypeDto) {
  const doc = await BookType.findById(id);
  if (!doc) throw notFound('Book type not found');
  if (dto.code && dto.code.toUpperCase() !== doc.code) {
    const clash = await BookType.findOne({ code: dto.code.toUpperCase() });
    if (clash) throw badRequest(`Book type code "${dto.code}" already exists`);
    doc.code = dto.code.toUpperCase();
  }
  if (dto.name !== undefined) doc.name = dto.name.trim();
  if (dto.name_bn !== undefined) doc.name_bn = dto.name_bn.trim();
  if (dto.description !== undefined) doc.description = dto.description?.trim();
  if (dto.notes !== undefined) doc.notes = dto.notes?.trim();
  if (dto.icon !== undefined) doc.icon = dto.icon?.trim();
  if (dto.sort_order !== undefined) doc.sort_order = dto.sort_order;
  await doc.save();
  return serializeBookType(doc);
}

export async function deleteBookType(id: string) {
  const doc = await BookType.findById(id);
  if (!doc) throw notFound('Book type not found');
  const inUse = await BookInfo.countDocuments({ book_type_id: doc._id, is_active: true });
  if (inUse > 0) throw badRequest('Cannot delete: books still use this type');
  doc.is_active = false;
  await doc.save();
  return { deleted: true };
}

export async function deleteBook(id: string) {
  const book = await BookInfo.findById(id);
  if (!book) throw notFound('Book not found');
  book.is_active = false;
  await book.save();
  return { deleted: true };
}

export async function deleteRegulation(id: string) {
  const reg = await Regulation.findById(id);
  if (!reg) throw notFound('Regulation not found');
  reg.is_active = false;
  await reg.save();
  return { deleted: true };
}

type BookListItem = Awaited<ReturnType<typeof listBooksFromDb>>[number];

async function listBooksFromDb(filters: { book_type_id?: string; q?: string; is_published?: boolean }) {
  const query: Record<string, unknown> = { is_active: true, is_superseded: false };
  if (filters.book_type_id) query.book_type_id = filters.book_type_id;
  if (filters.is_published !== undefined) query.is_published = filters.is_published;
  if (filters.q) {
    query.$or = [
      { name: { $regex: filters.q, $options: 'i' } },
      { name_bn: { $regex: filters.q, $options: 'i' } },
      { short_name: { $regex: filters.q, $options: 'i' } },
      { tags: filters.q },
    ];
  }

  const books = await BookInfo.find(query).sort({ name: 1 });
  const typeIds = [...new Set(books.map((b) => String(b.book_type_id)))];
  const types = await BookType.find({ _id: { $in: typeIds } });
  const typeMap = Object.fromEntries(types.map((t) => [String(t._id), t.name]));

  return books.map((b) => serializeBook(b, typeMap[String(b.book_type_id)]));
}

function filterCachedBooks(
  items: BookListItem[],
  filters: { book_type_id?: string; q?: string; is_published?: boolean },
) {
  let list = items;
  if (filters.book_type_id) {
    list = list.filter((b) => String(b.book_type_id) === filters.book_type_id);
  }
  if (filters.is_published !== undefined) {
    list = list.filter((b) => b.is_published === filters.is_published);
  }
  if (filters.q?.trim()) {
    const q = filters.q.trim().toLowerCase();
    list = list.filter((b) => {
      const tags = Array.isArray(b.tags) ? b.tags.join(' ') : '';
      return (
        (b.name ?? '').toLowerCase().includes(q) ||
        (b.name_bn ?? '').toLowerCase().includes(q) ||
        (b.short_name ?? '').toLowerCase().includes(q) ||
        tags.toLowerCase().includes(q)
      );
    });
  }
  return list;
}

export async function listBooks(
  filters: { book_type_id?: string; q?: string; is_published?: boolean },
  options?: { bypassCache?: boolean },
) {
  if (!options?.bypassCache) {
    const cached = cachedBooksList<BookListItem>();
    if (cached) return filterCachedBooks(cached, filters);
  }
  return listBooksFromDb(filters);
}

export async function getBookById(id: string) {
  const book = await BookInfo.findById(id);
  if (!book) throw notFound('Book not found');
  const bookType = await BookType.findById(book.book_type_id);
  return serializeBook(book, bookType?.name);
}

export async function getBookTree(bookId: string, depth = 2) {
  const book = await BookInfo.findById(bookId);
  if (!book) throw notFound('Book not found');
  const bookType = await BookType.findById(book.book_type_id);

  let nodes: unknown[] = [];
  if (book.is_part) {
    const parts = await BookPart.find({ book_info_id: bookId, is_active: true }).sort({ part_number: 1 });
    nodes = await Promise.all(
      parts.map(async (p) => ({
        type: 'part' as const,
        id: String(p._id),
        name: p.name,
        part_number: p.part_number,
        description: p.description,
        children: depth > 1 ? await loadChaptersForBook(bookId, String(p._id), depth - 1) : [],
        has_children: true,
      })),
    );
  } else {
    nodes = await loadChaptersForBook(bookId, null, depth);
  }

  return { book: serializeBook(book, bookType?.name), nodes };
}

export async function getBookChildren(type: 'part' | 'chapter' | 'topic', id: string) {
  if (type === 'part') {
    const part = await BookPart.findById(id);
    if (!part) throw notFound('Part not found');
    const chapters = await loadChaptersForBook(String(part.book_info_id), id, 2);
    return { type, id, children: chapters };
  }
  if (type === 'chapter') {
    const chapter = await BookChapter.findById(id);
    if (!chapter) throw notFound('Chapter not found');
    const topics = await loadTopicsForChapter(id, 2);
    return { type, id, children: topics };
  }
  const topic = await BookTopic.findById(id);
  if (!topic) throw notFound('Topic not found');
  const [subTopics, details] = await Promise.all([
    BookSubTopic.find({ book_topic_id: id, is_active: true }).sort({ sort_order: 1 }),
    BookTopicDetail.find({ book_topic_id: id, is_active: true }).sort({ sort_order: 1 }),
  ]);
  return {
    type,
    id,
    topic: {
      id: String(topic._id),
      name: topic.name,
      rule_number: topic.rule_number,
      description: topic.description,
      note: topic.note,
      is_amended: topic.is_amended,
      details: details.map((d) => ({ id: String(d._id), detail_text: d.detail_text })),
    },
    children: subTopics.map((st) => ({
      type: 'sub_topic' as const,
      id: String(st._id),
      name: st.name,
      rule_number: st.rule_number,
      description: st.description,
      note: st.note,
    })),
  };
}

export async function getTopicDetail(topicId: string) {
  const topic = await BookTopic.findById(topicId);
  if (!topic) throw notFound('Topic not found');
  const [details, subTopics, chapter, processes] = await Promise.all([
    BookTopicDetail.find({ book_topic_id: topicId, is_active: true }).sort({ sort_order: 1 }),
    BookSubTopic.find({ book_topic_id: topicId, is_active: true }).sort({ sort_order: 1 }),
    BookChapter.findById(topic.book_chapter_id),
    Process.find({ book_topic_id: topicId, is_active: true }).sort({ sort_order: 1 }),
  ]);
  const regulations = await Regulation.find({ book_topic_id: topicId, is_active: true });
  return {
    id: String(topic._id),
    name: topic.name,
    sub_name: topic.sub_name,
    rule_number: topic.rule_number,
    description: topic.description,
    note: topic.note,
    content_link: topic.content_link,
    table: topic.table,
    is_amended: topic.is_amended,
    chapter: chapter ? { id: String(chapter._id), name: chapter.name, chapter_number: chapter.chapter_number } : null,
    details: details.map((d) => ({ id: String(d._id), detail_text: d.detail_text })),
    sub_topics: subTopics.map((st) => ({
      id: String(st._id),
      name: st.name,
      rule_number: st.rule_number,
      description: st.description,
      note: st.note,
    })),
    regulations: regulations.map(serializeRegulation),
    processes: processes.map(serializeProcess),
  };
}

export async function createBook(dto: CreateBookDto) {
  if (!mongoose.isValidObjectId(dto.book_type_id)) throw badRequest('Invalid book type id');
  const bookType = await BookType.findById(dto.book_type_id);
  if (!bookType) throw notFound('Book type not found');

  const book = await BookInfo.create({
    ...dto,
    book_type_id: bookType._id,
    short_name: dto.short_name?.trim() ?? '',
    description: dto.description?.trim() ?? '',
    is_active: true,
    is_superseded: false,
    is_published: false,
    tags: dto.tags ?? [],
  });
  return serializeBook(book, bookType.name);
}

/** Draft -> published, visible to non-admin users (mobile app, web reader). */
export async function publishBook(id: string) {
  const book = await BookInfo.findById(id);
  if (!book || !book.is_active) throw notFound('Book not found');
  book.is_published = true;
  await book.save();
  const bookType = await BookType.findById(book.book_type_id);
  return serializeBook(book, bookType?.name);
}

/** Published -> draft, hidden from non-admin users again. */
export async function unpublishBook(id: string) {
  const book = await BookInfo.findById(id);
  if (!book || !book.is_active) throw notFound('Book not found');
  book.is_published = false;
  await book.save();
  const bookType = await BookType.findById(book.book_type_id);
  return serializeBook(book, bookType?.name);
}

export async function updateBook(id: string, dto: UpdateBookDto) {
  const book = await BookInfo.findById(id);
  if (!book) throw notFound('Book not found');
  if (dto.book_type_id) {
    const bookType = await BookType.findById(dto.book_type_id);
    if (!bookType) throw notFound('Book type not found');
    book.book_type_id = bookType._id;
  }
  Object.assign(book, {
    ...(dto.name !== undefined && { name: dto.name }),
    ...(dto.name_bn !== undefined && { name_bn: dto.name_bn }),
    ...(dto.short_name !== undefined && { short_name: dto.short_name.trim() }),
    ...(dto.description !== undefined && { description: dto.description.trim() }),
    ...(dto.edition !== undefined && { edition: dto.edition }),
    ...(dto.publish_date !== undefined && { publish_date: dto.publish_date }),
    ...(dto.published_by !== undefined && { published_by: dto.published_by }),
    ...(dto.effective_date !== undefined && { effective_date: dto.effective_date }),
    ...(dto.is_part !== undefined && { is_part: dto.is_part }),
    ...(dto.language !== undefined && { language: dto.language }),
    ...(dto.cover_image_url !== undefined && { cover_image_url: dto.cover_image_url }),
    ...(dto.tags !== undefined && { tags: dto.tags }),
    ...(dto.is_active !== undefined && { is_active: dto.is_active }),
    ...(dto.is_superseded !== undefined && { is_superseded: dto.is_superseded }),
    ...(dto.superseded_by !== undefined && { superseded_by: new mongoose.Types.ObjectId(dto.superseded_by) }),
  });
  await book.save();
  const bookType = await BookType.findById(book.book_type_id);
  return serializeBook(book, bookType?.name);
}

export async function listChapters(bookId: string) {
  const book = await BookInfo.findById(bookId);
  if (!book) throw notFound('Book not found');
  const chapters = await BookChapter.find({ book_info_id: bookId, is_active: true }).sort({ sort_order: 1 });
  const result = await Promise.all(
    chapters.map(async (c) => {
      const topicCount = await BookTopic.countDocuments({ book_chapter_id: c._id, is_active: true });
      return {
        id: String(c._id),
        name: c.name,
        sub_name: c.sub_name,
        chapter_number: c.chapter_number,
        description: c.description,
        sort_order: c.sort_order,
        topic_count: topicCount,
      };
    }),
  );
  return result;
}

export async function getBookReaderOutline(bookId: string) {
  const book = await BookInfo.findById(bookId);
  if (!book || !book.is_active) throw notFound('Book not found');
  const bookType = await BookType.findById(book.book_type_id);

  const chapters = await BookChapter.find({ book_info_id: bookId, is_active: true }).sort({
    sort_order: 1,
  });
  const chapterIds = chapters.map((c) => c._id);
  const topics =
    chapterIds.length > 0
      ? await BookTopic.find({ book_chapter_id: { $in: chapterIds }, is_active: true }).sort({
          sort_order: 1,
        })
      : [];

  const topicsByChapter = new Map<string, InstanceType<typeof BookTopic>[]>();
  for (const topic of topics) {
    const cid = String(topic.book_chapter_id);
    const list = topicsByChapter.get(cid) ?? [];
    list.push(topic);
    topicsByChapter.set(cid, list);
  }

  const chapterRows = chapters.map((c) => {
    const chapterTopics = topicsByChapter.get(String(c._id)) ?? [];
    return {
      id: String(c._id),
      chapter_number: c.chapter_number,
      name: c.name,
      sub_name: c.sub_name,
      description: c.description,
      sort_order: c.sort_order,
      topics: chapterTopics.map((t) => ({
        id: String(t._id),
        rule_number: t.rule_number,
        name: t.name,
        sub_name: t.sub_name,
        is_amended: t.is_amended,
        sort_order: t.sort_order,
      })),
    };
  });

  const rules = chapters.flatMap((c) => {
    const chapterTopics = topicsByChapter.get(String(c._id)) ?? [];
    return chapterTopics.map((t) => ({
      id: String(t._id),
      rule_number: t.rule_number,
      name: t.name,
      sub_name: t.sub_name,
      is_amended: t.is_amended,
      chapter_id: String(c._id),
      chapter_number: c.chapter_number,
      chapter_name: c.name,
    }));
  });

  return {
    book: serializeBook(book, bookType?.name),
    chapters: chapterRows,
    rules,
  };
}

export async function getBookReaderFull(bookId: string) {
  const outline = await getBookReaderOutline(bookId);
  const topicIds = outline.chapters.flatMap((c) => c.topics.map((t) => t.id));
  if (topicIds.length === 0) return outline;

  const topicOids = topicIds.map((id) => new mongoose.Types.ObjectId(id));
  const [topicRows, detailRows, subTopicRows, processRows] = await Promise.all([
    BookTopic.find({ _id: { $in: topicOids }, is_active: true }),
    BookTopicDetail.find({ book_topic_id: { $in: topicOids }, is_active: true }).sort({ sort_order: 1 }),
    BookSubTopic.find({ book_topic_id: { $in: topicOids }, is_active: true }).sort({ sort_order: 1 }),
    Process.find({ book_topic_id: { $in: topicOids }, is_active: true }).sort({ sort_order: 1 }),
  ]);

  const topicById = new Map(topicRows.map((t) => [String(t._id), t]));
  const detailsByTopic = new Map<string, { id: string; detail_text: string }[]>();
  for (const detail of detailRows) {
    const key = String(detail.book_topic_id);
    const list = detailsByTopic.get(key) ?? [];
    list.push({ id: String(detail._id), detail_text: detail.detail_text });
    detailsByTopic.set(key, list);
  }
  const subTopicsByTopic = new Map<
    string,
    { id: string; name?: string; rule_number?: string; description?: string; note?: string }[]
  >();
  for (const sub of subTopicRows) {
    const key = String(sub.book_topic_id);
    const list = subTopicsByTopic.get(key) ?? [];
    list.push({
      id: String(sub._id),
      name: sub.name,
      rule_number: sub.rule_number,
      description: sub.description,
      note: sub.note,
    });
    subTopicsByTopic.set(key, list);
  }
  const processesByTopic = new Map<string, ReturnType<typeof serializeProcess>[]>();
  for (const proc of processRows) {
    const key = String(proc.book_topic_id);
    const list = processesByTopic.get(key) ?? [];
    list.push(serializeProcess(proc));
    processesByTopic.set(key, list);
  }

  const chapters = outline.chapters.map((chapter) => ({
    ...chapter,
    topics: chapter.topics.map((topic) => {
      const row = topicById.get(topic.id);
      return {
        ...topic,
        description: row?.description,
        note: row?.note,
        content_link: row?.content_link,
        table: row?.table,
        details: detailsByTopic.get(topic.id) ?? [],
        sub_topics: subTopicsByTopic.get(topic.id) ?? [],
        processes: processesByTopic.get(topic.id) ?? [],
      };
    }),
  }));

  return { book: outline.book, chapters, rules: outline.rules };
}

function serializeChapter(chapter: InstanceType<typeof BookChapter>) {
  return {
    id: String(chapter._id),
    book_info_id: String(chapter.book_info_id),
    book_parts_id: idStr(chapter.book_parts_id),
    name: chapter.name,
    sub_name: chapter.sub_name,
    chapter_number: chapter.chapter_number,
    description: chapter.description,
    sort_order: chapter.sort_order,
    is_active: chapter.is_active,
  };
}

export async function getChapterById(chapterId: string) {
  const chapter = await BookChapter.findById(chapterId);
  if (!chapter || !chapter.is_active) throw notFound('Chapter not found');
  const topics = await BookTopic.find({ book_chapter_id: chapterId, is_active: true }).sort({ sort_order: 1 });
  return {
    ...serializeChapter(chapter),
    topics: topics.map((t) => ({
      id: String(t._id),
      name: t.name,
      sub_name: t.sub_name,
      rule_number: t.rule_number,
      description: t.description,
      note: t.note,
      content_link: t.content_link,
      table: t.table,
      sort_order: t.sort_order,
      is_amended: t.is_amended,
    })),
  };
}

export async function listChapterQuestions(chapterId: string) {
  const chapter = await BookChapter.findById(chapterId);
  if (!chapter || !chapter.is_active) throw notFound('Chapter not found');

  const chapterOid = chapter._id;
  const topicIds = await BookTopic.find({ book_chapter_id: chapterOid, is_active: true }).distinct('_id');
  const subTopicIds =
    topicIds.length > 0
      ? await BookSubTopic.find({ book_topic_id: { $in: topicIds }, is_active: true }).distinct('_id')
      : [];

  const linkRows = await QuestionBookLink.find({
    is_active: true,
    $or: [
      { book_chapter_id: chapterOid },
      { book_topic_id: { $in: topicIds } },
      ...(subTopicIds.length > 0 ? [{ book_sub_topic_id: { $in: subTopicIds } }] : []),
    ],
  });
  const linkedIds = [...new Set(linkRows.map((l) => String(l.question_id)))];

  const direct = await Question.find({
    book_chapter_id: chapterOid,
    is_active: true,
    is_published: true,
  });
  const allIds = [...new Set([...linkedIds, ...direct.map((q) => String(q._id))])];
  if (allIds.length === 0) return [];

  const questions = await Question.find({
    _id: { $in: allIds },
    is_active: true,
    is_published: true,
  }).sort({ question_type_code: 1, updated_at: -1 });

  const typeIds = [...new Set(questions.map((q) => String(q.question_type_id)))];
  const types = await QuestionType.find({ _id: { $in: typeIds } });
  const typeMap = new Map(types.map((t) => [String(t._id), t.name]));

  return questions.map((q) => ({
    id: String(q._id),
    question_type_code: q.question_type_code,
    question_type_name: typeMap.get(String(q.question_type_id)),
    body_en: q.body_en,
    body_bn: q.body_bn,
    marks: q.marks,
    difficulty: q.difficulty,
  }));
}

export async function listChapterQuestionsForManage(chapterId: string) {
  const chapter = await BookChapter.findById(chapterId);
  if (!chapter || !chapter.is_active) throw notFound('Chapter not found');

  const chapterOid = chapter._id;
  const topics = await BookTopic.find({ book_chapter_id: chapterOid, is_active: true }).sort({ sort_order: 1 });
  const topicIds = topics.map((t) => t._id);
  const subTopics =
    topicIds.length > 0
      ? await BookSubTopic.find({ book_topic_id: { $in: topicIds }, is_active: true }).sort({ sort_order: 1 })
      : [];
  const subTopicIds = subTopics.map((s) => s._id);

  const linkRows = await QuestionBookLink.find({
    is_active: true,
    $or: [
      { book_chapter_id: chapterOid },
      ...(topicIds.length > 0 ? [{ book_topic_id: { $in: topicIds } }] : []),
      ...(subTopicIds.length > 0 ? [{ book_sub_topic_id: { $in: subTopicIds } }] : []),
    ],
  }).sort({ sort_order: 1 });

  const topicMap = new Map(topics.map((t) => [String(t._id), t]));
  const subTopicMap = new Map(subTopics.map((s) => [String(s._id), s]));
  const book = await BookInfo.findById(chapter.book_info_id);

  const questionIds = [...new Set(linkRows.map((l) => String(l.question_id)))];
  if (questionIds.length === 0) return [];

  const questions = await Question.find({ _id: { $in: questionIds }, is_active: true });
  const qMap = new Map(questions.map((q) => [String(q._id), q]));

  return linkRows
    .map((link) => {
      const q = qMap.get(String(link.question_id));
      if (!q) return null;

      const topic = link.book_topic_id ? topicMap.get(String(link.book_topic_id)) : undefined;
      const subTopic = link.book_sub_topic_id ? subTopicMap.get(String(link.book_sub_topic_id)) : undefined;
      const parts: string[] = [];
      if (book) parts.push(book.short_name || book.name);
      parts.push(`Ch. ${chapter.chapter_number} ${chapter.name}`.trim());
      if (topic) parts.push(topic.rule_number ? `Rule ${topic.rule_number}` : topic.name || 'Rule');
      if (subTopic) parts.push(subTopic.rule_number || subTopic.name || 'Sub-rule');

      return {
        link_id: String(link._id),
        question_id: String(q._id),
        link_level: link.link_level,
        link_label: parts.join(' › '),
        book_topic_id: idStr(link.book_topic_id),
        book_sub_topic_id: idStr(link.book_sub_topic_id),
        regulation_id: idStr(link.regulation_id),
        body_en: q.body_en,
        marks: q.marks,
        question_type_code: q.question_type_code,
        is_published: q.is_published,
        review_status: q.review_status,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

function serializeSubTopic(sub: InstanceType<typeof BookSubTopic>) {
  return {
    id: String(sub._id),
    book_topic_id: String(sub.book_topic_id),
    name: sub.name,
    rule_number: sub.rule_number,
    description: sub.description,
    note: sub.note,
    sort_order: sub.sort_order,
    is_active: sub.is_active,
  };
}

export async function getSubTopicById(subTopicId: string) {
  const sub = await BookSubTopic.findById(subTopicId);
  if (!sub || !sub.is_active) throw notFound('Sub-topic not found');
  return serializeSubTopic(sub);
}

export async function createChapter(bookId: string, dto: CreateBookChapterDto) {
  const book = await BookInfo.findById(bookId);
  if (!book) throw notFound('Book not found');
  const count = await BookChapter.countDocuments({ book_info_id: bookId, is_active: true });
  const sortOrder = dto.sort_order ?? count + 1;
  const chapter = await BookChapter.create({
    book_info_id: book._id,
    book_parts_id: dto.book_parts_id ? new mongoose.Types.ObjectId(dto.book_parts_id) : undefined,
    name: dto.name,
    sub_name: dto.sub_name,
    chapter_number: dto.chapter_number,
    description: dto.description,
    sort_order: sortOrder,
    is_active: true,
  });
  return serializeChapter(chapter);
}

export async function updateChapter(chapterId: string, dto: UpdateBookChapterDto) {
  const chapter = await BookChapter.findById(chapterId);
  if (!chapter) throw notFound('Chapter not found');
  if (dto.name !== undefined) chapter.name = dto.name;
  if (dto.sub_name !== undefined) chapter.sub_name = dto.sub_name;
  if (dto.chapter_number !== undefined) chapter.chapter_number = dto.chapter_number;
  if (dto.description !== undefined) chapter.description = dto.description;
  if (dto.sort_order !== undefined) chapter.sort_order = dto.sort_order;
  if (dto.book_parts_id !== undefined) {
    chapter.book_parts_id = dto.book_parts_id
      ? new mongoose.Types.ObjectId(dto.book_parts_id)
      : undefined;
  }
  if (dto.is_active !== undefined) chapter.is_active = dto.is_active;
  await chapter.save();
  return serializeChapter(chapter);
}

export async function deleteChapter(chapterId: string) {
  const chapter = await BookChapter.findById(chapterId);
  if (!chapter) throw notFound('Chapter not found');
  chapter.is_active = false;
  await chapter.save();
  const topics = await BookTopic.find({ book_chapter_id: chapterId });
  for (const t of topics) {
    t.is_active = false;
    await t.save();
    await BookSubTopic.updateMany({ book_topic_id: t._id }, { is_active: false });
  }
  return { deleted: true };
}

export async function createTopic(chapterId: string, dto: CreateBookTopicDto) {
  const chapter = await BookChapter.findById(chapterId);
  if (!chapter) throw notFound('Chapter not found');
  const count = await BookTopic.countDocuments({ book_chapter_id: chapterId, is_active: true });
  const sortOrder = dto.sort_order ?? count + 1;
  const topic = await BookTopic.create({
    book_chapter_id: chapter._id,
    name: dto.name?.trim() ?? '',
    sub_name: dto.sub_name,
    rule_number: dto.rule_number,
    description: dto.description,
    note: dto.note,
    content_link: dto.content_link?.trim() || undefined,
    table: cleanComparisonTable(dto.table),
    effective_date: dto.effective_date,
    sort_order: sortOrder,
    is_amended: false,
    is_active: true,
  });
  return {
    id: String(topic._id),
    name: topic.name,
    rule_number: topic.rule_number,
    content_link: topic.content_link,
    table: topic.table,
    sort_order: topic.sort_order,
  };
}

export async function updateTopic(topicId: string, dto: UpdateBookTopicDto) {
  const topic = await BookTopic.findById(topicId);
  if (!topic) throw notFound('Topic not found');

  if (dto.book_chapter_id !== undefined) {
    if (!mongoose.isValidObjectId(dto.book_chapter_id)) throw badRequest('Invalid chapter id');
    const targetChapter = await BookChapter.findById(dto.book_chapter_id);
    if (!targetChapter || !targetChapter.is_active) throw notFound('Target chapter not found');

    const currentChapter = await BookChapter.findById(topic.book_chapter_id);
    if (!currentChapter) throw notFound('Current chapter not found');
    if (String(currentChapter.book_info_id) !== String(targetChapter.book_info_id)) {
      throw badRequest('Cannot move rule to a chapter in a different book');
    }

    if (String(topic.book_chapter_id) !== String(targetChapter._id)) {
      topic.book_chapter_id = targetChapter._id;
      if (dto.sort_order === undefined) {
        const count = await BookTopic.countDocuments({
          book_chapter_id: targetChapter._id,
          is_active: true,
        });
        topic.sort_order = count + 1;
      }
    }
  }

  if (dto.name !== undefined) topic.name = dto.name.trim();
  if (dto.sub_name !== undefined) topic.sub_name = dto.sub_name;
  if (dto.rule_number !== undefined) topic.rule_number = dto.rule_number;
  if (dto.description !== undefined) topic.description = dto.description;
  if (dto.note !== undefined) topic.note = dto.note;
  if (dto.content_link !== undefined) {
    const link = dto.content_link.trim();
    topic.content_link = link || undefined;
    if (!link) topic.set('content_link', undefined);
  }
  if (dto.table !== undefined) {
    const cleaned = dto.table === null ? undefined : cleanComparisonTable(dto.table);
    topic.table = cleaned;
    if (!cleaned) topic.set('table', undefined);
  }
  if (dto.effective_date !== undefined) topic.effective_date = dto.effective_date;
  if (dto.sort_order !== undefined) topic.sort_order = dto.sort_order;
  if (dto.is_active !== undefined) topic.is_active = dto.is_active;
  await topic.save();
  return {
    id: String(topic._id),
    name: topic.name,
    rule_number: topic.rule_number,
    book_chapter_id: String(topic.book_chapter_id),
    content_link: topic.content_link,
    table: topic.table,
    sort_order: topic.sort_order,
  };
}

export async function deleteTopic(topicId: string) {
  const topic = await BookTopic.findById(topicId);
  if (!topic) throw notFound('Topic not found');
  topic.is_active = false;
  await topic.save();
  await BookSubTopic.updateMany({ book_topic_id: topicId }, { is_active: false });
  await Process.updateMany({ book_topic_id: topicId }, { is_active: false });
  return { deleted: true };
}

function serializeProcess(proc: InstanceType<typeof Process>) {
  return {
    id: String(proc._id),
    book_topic_id: String(proc.book_topic_id),
    title: proc.title,
    details: proc.details,
    steps: proc.steps.map((s) => ({ title: s.title, description: s.description, role: s.role })),
    sort_order: proc.sort_order,
  };
}

export async function listProcessesForTopic(topicId: string) {
  const rows = await Process.find({ book_topic_id: topicId, is_active: true }).sort({ sort_order: 1 });
  return rows.map(serializeProcess);
}

export async function createProcess(topicId: string, dto: CreateProcessDto) {
  const topic = await BookTopic.findById(topicId);
  if (!topic) throw notFound('Topic not found');
  const count = await Process.countDocuments({ book_topic_id: topicId, is_active: true });
  const sortOrder = dto.sort_order ?? count + 1;
  const proc = await Process.create({
    book_topic_id: topic._id,
    title: dto.title.trim(),
    details: dto.details,
    steps: dto.steps ?? [],
    sort_order: sortOrder,
    is_active: true,
  });
  return serializeProcess(proc);
}

export async function updateProcess(processId: string, dto: UpdateProcessDto) {
  const proc = await Process.findById(processId);
  if (!proc) throw notFound('Process not found');
  if (dto.title !== undefined) proc.title = dto.title.trim();
  if (dto.details !== undefined) proc.details = dto.details;
  if (dto.steps !== undefined) proc.steps = dto.steps;
  if (dto.sort_order !== undefined) proc.sort_order = dto.sort_order;
  if (dto.is_active !== undefined) proc.is_active = dto.is_active;
  await proc.save();
  return serializeProcess(proc);
}

export async function deleteProcess(processId: string) {
  const proc = await Process.findById(processId);
  if (!proc) throw notFound('Process not found');
  proc.is_active = false;
  await proc.save();
  return { deleted: true };
}

export async function createSubTopic(topicId: string, dto: CreateBookSubTopicDto) {
  const topic = await BookTopic.findById(topicId);
  if (!topic) throw notFound('Topic not found');
  const count = await BookSubTopic.countDocuments({ book_topic_id: topicId, is_active: true });
  const sortOrder = dto.sort_order ?? count + 1;
  const sub = await BookSubTopic.create({
    book_topic_id: topic._id,
    name: dto.name?.trim() ?? '',
    rule_number: dto.rule_number,
    description: dto.description,
    note: dto.note,
    sort_order: sortOrder,
    is_active: true,
  });
  return serializeSubTopic(sub);
}

export async function updateSubTopic(subTopicId: string, dto: UpdateBookSubTopicDto) {
  const sub = await BookSubTopic.findById(subTopicId);
  if (!sub) throw notFound('Sub-topic not found');
  if (dto.name !== undefined) sub.name = dto.name.trim();
  if (dto.rule_number !== undefined) sub.rule_number = dto.rule_number;
  if (dto.description !== undefined) sub.description = dto.description;
  if (dto.note !== undefined) sub.note = dto.note;
  if (dto.sort_order !== undefined) sub.sort_order = dto.sort_order;
  if (dto.is_active !== undefined) sub.is_active = dto.is_active;
  await sub.save();
  return serializeSubTopic(sub);
}

export async function deleteSubTopic(subTopicId: string) {
  const sub = await BookSubTopic.findById(subTopicId);
  if (!sub) throw notFound('Sub-topic not found');
  sub.is_active = false;
  await sub.save();
  return { deleted: true };
}

export async function searchRegulations(filters: {
  q?: string;
  book_id?: string;
  regulation_type?: string;
  payment_related?: boolean;
  limit: number;
}) {
  const query: Record<string, unknown> = { is_active: true };
  if (filters.book_id) query.book_info_id = filters.book_id;
  if (filters.regulation_type) query.regulation_type = filters.regulation_type;
  if (filters.payment_related !== undefined) query.payment_related = filters.payment_related;

  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query.$or = [
      { regulation_no: { $regex: q, $options: 'i' } },
      { title: { $regex: q, $options: 'i' } },
      { full_text: { $regex: q, $options: 'i' } },
      { tags: q },
    ];
  }

  const items = await Regulation.find(query).sort({ regulation_no: 1 }).limit(filters.limit);
  return items.map(serializeRegulation);
}

export async function getRegulationById(id: string) {
  const reg = await Regulation.findById(id);
  if (!reg) throw notFound('Regulation not found');
  const amendments = await RegulationAmendment.find({ regulation_id: id, is_active: true }).sort({
    amendment_date: -1,
  });
  const book = await BookInfo.findById(reg.book_info_id);
  return {
    ...serializeRegulation(reg),
    book_name: book?.name,
    book_short_name: book?.short_name,
    amendments: amendments.map((a) => ({
      id: String(a._id),
      amendment_no: a.amendment_no,
      amendment_date: a.amendment_date,
      issued_by: a.issued_by,
      circular_ref: a.circular_ref,
      old_text: a.old_text,
      new_text: a.new_text,
      change_summary: a.change_summary,
      created_at: a.created_at,
    })),
  };
}

export async function createRegulation(dto: CreateRegulationDto) {
  const book = await BookInfo.findById(dto.book_info_id);
  if (!book) throw notFound('Book not found');
  const exists = await Regulation.findOne({ regulation_no: dto.regulation_no, is_active: true });
  if (exists) {
    throw badRequest(
      `Regulation number "${dto.regulation_no}" already exists. Use a unique number (e.g. ${dto.regulation_no}-2).`,
    );
  }

  const reg = await Regulation.create({
    ...dto,
    book_info_id: book._id,
    book_chapter_id: dto.book_chapter_id ? new mongoose.Types.ObjectId(dto.book_chapter_id) : undefined,
    book_topic_id: dto.book_topic_id ? new mongoose.Types.ObjectId(dto.book_topic_id) : undefined,
    is_active: true,
    is_amended: false,
    tags: dto.tags ?? [],
  });
  return serializeRegulation(reg);
}

export async function updateRegulation(id: string, dto: UpdateRegulationDto) {
  const reg = await Regulation.findById(id);
  if (!reg) throw notFound('Regulation not found');
  if (dto.regulation_no !== undefined && dto.regulation_no !== reg.regulation_no) {
    const taken = await Regulation.findOne({ regulation_no: dto.regulation_no, _id: { $ne: reg._id } });
    if (taken) throw badRequest('Regulation number already exists');
    reg.regulation_no = dto.regulation_no;
  }
  if (dto.title !== undefined) reg.title = dto.title;
  if (dto.full_text !== undefined) reg.full_text = dto.full_text;
  if (dto.regulation_type !== undefined) reg.regulation_type = dto.regulation_type;
  if (dto.effective_date !== undefined) reg.effective_date = dto.effective_date;
  if (dto.applicable_to !== undefined) reg.applicable_to = dto.applicable_to;
  if (dto.payment_related !== undefined) reg.payment_related = dto.payment_related;
  if (dto.receipt_related !== undefined) reg.receipt_related = dto.receipt_related;
  if (dto.tags !== undefined) reg.tags = dto.tags;
  if (dto.is_active !== undefined) reg.is_active = dto.is_active;
  if (dto.book_chapter_id !== undefined) {
    reg.book_chapter_id = dto.book_chapter_id
      ? new mongoose.Types.ObjectId(dto.book_chapter_id)
      : undefined;
  }
  if (dto.book_topic_id !== undefined) {
    reg.book_topic_id = dto.book_topic_id ? new mongoose.Types.ObjectId(dto.book_topic_id) : undefined;
  }
  await reg.save();
  return serializeRegulation(reg);
}

export async function listRegulationsForBook(bookId: string) {
  const items = await Regulation.find({ book_info_id: bookId, is_active: true }).sort({ regulation_no: 1 });
  return items.map(serializeRegulation);
}

export async function createAmendment(regulationId: string, dto: CreateAmendmentDto) {
  const reg = await Regulation.findById(regulationId);
  if (!reg) throw notFound('Regulation not found');

  const amendment = await RegulationAmendment.create({
    regulation_id: reg._id,
    ...dto,
    old_text: dto.old_text ?? reg.full_text,
    is_active: true,
  });

  reg.is_amended = true;
  reg.full_text = dto.new_text;
  await reg.save();

  if (reg.book_topic_id) {
    await BookTopic.updateOne({ _id: reg.book_topic_id }, { is_amended: true });
  }

  return {
    id: String(amendment._id),
    amendment_no: amendment.amendment_no,
    amendment_date: amendment.amendment_date,
    change_summary: amendment.change_summary,
  };
}

export async function listAmendments(regulationId: string) {
  const reg = await Regulation.findById(regulationId);
  if (!reg) throw notFound('Regulation not found');
  const items = await RegulationAmendment.find({ regulation_id: regulationId }).sort({ amendment_date: -1 });
  return items.map((a) => ({
    id: String(a._id),
    amendment_no: a.amendment_no,
    amendment_date: a.amendment_date,
    issued_by: a.issued_by,
    circular_ref: a.circular_ref,
    change_summary: a.change_summary,
    is_active: a.is_active,
    created_at: a.created_at,
  }));
}
