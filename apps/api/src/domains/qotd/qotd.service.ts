import mongoose from 'mongoose';
import type { CreateQotdEntryDto, UpdateQotdEntryDto } from '@ibas/shared-types';
import { QotdEntry } from './models/QotdEntry.model.js';
import { QotdSettings } from './models/QotdSettings.model.js';
import { ExamSubject } from '../exams/models/ExamSubject.model.js';
import { Question } from '../questions/models/Question.model.js';
import { BookChapter } from '../books/models/BookChapter.model.js';
import { getSyllabusTree } from '../syllabus/syllabus.service.js';
import { notFound, badRequest } from '../../shared/errors/AppError.js';
import { bdToday as todayStr, bdCutoff as cutoffStr, bdNowTime as nowTimeStr } from '../../shared/bd-time.js';
import {
  subjectObjectIds,
  type ExamSubjectScope,
} from '../users/subject-access.service.js';

const DEFAULT_SHOW_PAST_DAYS = 7;

export async function getQotdSettings() {
  const doc = await QotdSettings.findOne({ key: 'global' });
  return { show_past_days: doc?.show_past_days ?? DEFAULT_SHOW_PAST_DAYS };
}

export async function updateQotdSettings(showPastDays: number, updatedBy: string) {
  await QotdSettings.findOneAndUpdate(
    { key: 'global' },
    { show_past_days: showPastDays, updated_by: updatedBy, updated_at: new Date() },
    { upsert: true, setDefaultsOnInsert: true },
  );
  return { show_past_days: showPastDays };
}

/** Admins see every entry; regular users only see past days (within the window) and today's
 * entries once their publish_time has arrived — future-dated entries are excluded by date alone. */
async function visibilityFilter(isAdmin: boolean): Promise<Record<string, unknown>> {
  if (isAdmin) return {};
  const settings = await getQotdSettings();
  const today = todayStr();
  return {
    $or: [
      { date: { $gte: cutoffStr(settings.show_past_days), $lt: today } },
      { date: today, publish_time: { $lte: nowTimeStr() } },
    ],
  };
}

/**
 * Walks a subject's syllabus tree and returns a Mongo match condition selecting every question
 * linked at or below the most specific level each reference points to (rule > chapter > book) —
 * mirrors the "most specific wins" resolution already used to store syllabus references.
 */
async function syllabusQuestionMatch(examSubjectId: string): Promise<Record<string, unknown> | null> {
  const tree = await getSyllabusTree(examSubjectId);
  const allTopics = [...tree.groups.flatMap((g) => g.topics), ...tree.subject_topics];
  const references = allTopics.flatMap((t) => t.references);
  if (references.length === 0) return null;

  const bookTopicIds = new Set<string>();
  const regulationIds = new Set<string>();
  const chapterIds = new Set<string>();
  const bookOnlyIds = new Set<string>();

  for (const ref of references) {
    if (ref.book_topic_id) {
      bookTopicIds.add(ref.book_topic_id);
    } else if (ref.regulation_id) {
      regulationIds.add(ref.regulation_id);
    } else if (ref.book_chapter_id) {
      chapterIds.add(ref.book_chapter_id);
    } else if (ref.book_info_id) {
      bookOnlyIds.add(ref.book_info_id);
    }
  }

  if (bookOnlyIds.size > 0) {
    const chapters = await BookChapter.find({
      book_info_id: { $in: [...bookOnlyIds] },
      is_active: true,
    }).select('_id');
    for (const c of chapters) chapterIds.add(String(c._id));
  }

  const or: Record<string, unknown>[] = [];
  if (bookTopicIds.size > 0) or.push({ book_topic_id: { $in: [...bookTopicIds] } });
  if (regulationIds.size > 0) or.push({ regulation_id: { $in: [...regulationIds] } });
  if (chapterIds.size > 0) or.push({ book_chapter_id: { $in: [...chapterIds] } });

  return or.length > 0 ? { $or: or } : null;
}

export async function listSyllabusQuestions(
  examSubjectId: string,
  filters: { q?: string; limit: number; offset: number },
) {
  const subject = await ExamSubject.findById(examSubjectId);
  if (!subject || !subject.is_active) throw notFound('Exam subject not found');

  const match = await syllabusQuestionMatch(examSubjectId);
  if (!match) return { items: [], total: 0, has_more: false };

  const query: Record<string, unknown> = { ...match, is_published: true, is_active: true };
  if (filters.q?.trim()) {
    const q = filters.q.trim();
    query.$and = [{ $or: [{ body_en: { $regex: q, $options: 'i' } }, { body_bn: { $regex: q, $options: 'i' } }] }];
  }

  const [total, items] = await Promise.all([
    Question.countDocuments(query),
    Question.find(query).sort({ updated_at: -1 }).skip(filters.offset).limit(filters.limit),
  ]);

  const chapterIds = [...new Set(items.map((q) => q.book_chapter_id).filter(Boolean))].map(String);
  const chapters = chapterIds.length > 0 ? await BookChapter.find({ _id: { $in: chapterIds } }) : [];
  const bookIds = [...new Set(chapters.map((c) => String(c.book_info_id)))];
  const { BookInfo } = await import('../books/models/BookInfo.model.js');
  const books = bookIds.length > 0 ? await BookInfo.find({ _id: { $in: bookIds } }) : [];
  const bookNameByChapter = new Map(
    chapters.map((c) => [String(c._id), books.find((b) => String(b._id) === String(c.book_info_id))?.name]),
  );

  return {
    items: items.map((q) => ({
      id: String(q._id),
      body_en: q.body_en,
      body_bn: q.body_bn,
      question_type_code: q.question_type_code,
      marks: q.marks,
      book_name: q.book_chapter_id ? bookNameByChapter.get(String(q.book_chapter_id)) : undefined,
    })),
    total,
    has_more: filters.offset + items.length < total,
  };
}

export async function createQotdEntry(dto: CreateQotdEntryDto, createdBy: string) {
  const subject = await ExamSubject.findById(dto.exam_subject_id);
  if (!subject || !subject.is_active) throw notFound('Exam subject not found');

  const validCount = await Question.countDocuments({
    _id: { $in: dto.question_ids },
    is_published: true,
    is_active: true,
  });
  if (validCount !== dto.question_ids.length) {
    throw badRequest('One or more selected questions are not available');
  }

  try {
    const entry = await QotdEntry.create({
      exam_subject_id: dto.exam_subject_id,
      date: dto.date,
      publish_time: dto.publish_time ?? '00:00',
      question_ids: dto.question_ids,
      created_by: createdBy,
      is_active: true,
    });
    return {
      id: String(entry._id),
      exam_subject_id: String(entry.exam_subject_id),
      date: entry.date,
      publish_time: entry.publish_time,
      question_count: entry.question_ids.length,
    };
  } catch (err) {
    if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
      throw badRequest('This subject already has questions set for this date');
    }
    throw err;
  }
}

export async function updateQotdEntry(id: string, dto: UpdateQotdEntryDto) {
  const entry = await QotdEntry.findById(id);
  if (!entry) throw notFound('Question entry not found');

  if (dto.question_ids) {
    const validCount = await Question.countDocuments({
      _id: { $in: dto.question_ids },
      is_published: true,
      is_active: true,
    });
    if (validCount !== dto.question_ids.length) {
      throw badRequest('One or more selected questions are not available');
    }
    entry.question_ids = dto.question_ids.map((id) => new mongoose.Types.ObjectId(id));
  }
  if (dto.publish_time !== undefined) entry.publish_time = dto.publish_time;
  if (dto.is_active !== undefined) entry.is_active = dto.is_active;

  await entry.save();
  return {
    id: String(entry._id),
    exam_subject_id: String(entry.exam_subject_id),
    date: entry.date,
    publish_time: entry.publish_time,
    question_count: entry.question_ids.length,
  };
}

export async function deleteQotdEntry(id: string) {
  const entry = await QotdEntry.findById(id);
  if (!entry) throw notFound('Question entry not found');
  entry.is_active = false;
  await entry.save();
  return { deleted: true };
}

export async function listQotdDates(isAdmin: boolean, subjectScope?: ExamSubjectScope) {
  const visibility = await visibilityFilter(isAdmin);
  const subjectIds = subjectObjectIds(subjectScope ?? { mode: 'all' });
  if (subjectIds && subjectIds.length === 0) return [];

  const match: Record<string, unknown> = { is_active: true, ...visibility };
  if (subjectIds) match.exam_subject_id = { $in: subjectIds };

  const rows = await QotdEntry.aggregate<{ _id: string; subject_count: number; question_count: number }>([
    { $match: match },
    {
      $group: {
        _id: '$date',
        subject_count: { $sum: 1 },
        question_count: { $sum: { $size: '$question_ids' } },
      },
    },
    { $sort: { _id: -1 } },
  ]);
  return rows.map((r) => ({ date: r._id, subject_count: r.subject_count, question_count: r.question_count }));
}

async function resolveQuestionItems(questionIds: (mongoose.Types.ObjectId | string)[]) {
  const questions = await Question.find({ _id: { $in: questionIds } });
  const chapterIds = [...new Set(questions.map((q) => q.book_chapter_id).filter(Boolean))].map(String);
  const chapters = chapterIds.length > 0 ? await BookChapter.find({ _id: { $in: chapterIds } }) : [];
  const bookIds = [...new Set(chapters.map((c) => String(c.book_info_id)))];
  const { BookInfo } = await import('../books/models/BookInfo.model.js');
  const books = bookIds.length > 0 ? await BookInfo.find({ _id: { $in: bookIds } }) : [];
  const bookNameByChapter = new Map(
    chapters.map((c) => [String(c._id), books.find((b) => String(b._id) === String(c.book_info_id))?.name]),
  );
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  return { byId, bookNameByChapter };
}

export async function getEntriesForDate(
  date: string,
  isAdmin: boolean,
  subjectScope?: ExamSubjectScope,
) {
  const visibility = await visibilityFilter(isAdmin);
  const allowedSubjectIds = subjectObjectIds(subjectScope ?? { mode: 'all' });
  if (allowedSubjectIds && allowedSubjectIds.length === 0) {
    if (isAdmin) return { date, groups: [] };
    throw notFound('No questions found for this date');
  }

  const query: Record<string, unknown> = { is_active: true, date, ...visibility };
  if (allowedSubjectIds) query.exam_subject_id = { $in: allowedSubjectIds };
  const entries = await QotdEntry.find(query);

  if (entries.length === 0) {
    if (isAdmin) return { date, groups: [] };
    throw notFound('No questions found for this date');
  }

  const subjectIds = [...new Set(entries.map((e) => String(e.exam_subject_id)))];
  const subjects = await ExamSubject.find({ _id: { $in: subjectIds } });
  const nameById = new Map(subjects.map((s) => [String(s._id), s.name]));

  const allQuestionIds = entries.flatMap((e) => e.question_ids);
  const { byId, bookNameByChapter } = await resolveQuestionItems(allQuestionIds);

  const groups = entries
    .map((e) => ({
      entry_id: String(e._id),
      exam_subject_id: String(e.exam_subject_id),
      subject_name: nameById.get(String(e.exam_subject_id)) ?? 'Unknown subject',
      publish_time: e.publish_time,
      questions: e.question_ids
        .map((qid) => byId.get(String(qid)))
        .filter((q): q is NonNullable<typeof q> => Boolean(q))
        .map((q) => ({
          id: String(q._id),
          body_en: q.body_en,
          body_bn: q.body_bn,
          question_type_code: q.question_type_code,
          marks: q.marks,
          book_name: q.book_chapter_id ? bookNameByChapter.get(String(q.book_chapter_id)) : undefined,
        })),
    }))
    .sort((a, b) => a.subject_name.localeCompare(b.subject_name));

  return { date, groups };
}
