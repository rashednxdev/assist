import mongoose from 'mongoose';
import type {
  PreparationBookRow,
  PreparationChapterRow,
  PreparationClassRow,
  PreparationNextClassBrief,
  PreparationPackageBrief,
  PreparationPaperRow,
  PreparationPreviewBook,
  PreparationQuizQuestion,
  PreparationSubjectSummary,
  PreparationSubjectWorkspace,
  PreparationWrittenRow,
} from '@ibas/shared-types';
import { forbidden, notFound } from '../../shared/errors/AppError.js';
import { AccessPackage } from '../billing/models/AccessPackage.model.js';
import { LiveProgram } from '../billing/models/LiveProgram.model.js';
import { UserEntitlement } from '../billing/models/UserEntitlement.model.js';
import { BookChapter } from '../books/models/BookChapter.model.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { BookSubjectLink } from '../books/models/BookSubjectLink.model.js';
import { UserQuestionEvaluation } from '../evaluation/models/UserQuestionEvaluation.model.js';
import { LiveStream } from '../live-stream/models/LiveStream.model.js';
import { PaperDetail } from '../papers/models/PaperDetail.model.js';
import { PaperQuestion } from '../papers/models/PaperQuestion.model.js';
import { Question } from '../questions/models/Question.model.js';
import { QuestionAnswer } from '../questions/models/QuestionAnswer.model.js';
import { QuestionAnswerDetail } from '../questions/models/QuestionAnswerDetail.model.js';
import { QuestionBookLink } from '../questions/models/QuestionBookLink.model.js';
import { QuestionOption } from '../questions/models/QuestionOption.model.js';
import { QuestionSubjectLink } from '../questions/models/QuestionSubjectLink.model.js';
import { listPartsForUser } from './exam-prep.service.js';

const WRITTEN_LIMIT = 400;
const OBJECTIVE = ['MCQ', 'TF'];
const UNASSIGNED_CHAPTER_ID = 'unassigned';

function oid(id: string) {
  return new mongoose.Types.ObjectId(id);
}

function plain(value?: string | null): string {
  return (value ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function countMap(rows: Array<{ _id: unknown; n: number }>): Map<string, number> {
  return new Map(rows.map((row) => [String(row._id), row.n]));
}

function extractExplanationText(detail?: {
  explanation?: string;
  explanation_sections?: Array<{ title?: string; details?: string; note?: string }>;
  note?: string;
} | null): string | undefined {
  if (!detail) return undefined;
  const parts: string[] = [];
  if (detail.explanation?.trim()) parts.push(plain(detail.explanation));
  for (const sec of detail.explanation_sections ?? []) {
    const line = [sec.title?.trim(), plain(sec.details), plain(sec.note)].filter(Boolean).join(' — ');
    if (line) parts.push(line);
  }
  if (parts.length === 0 && detail.note?.trim()) parts.push(plain(detail.note));
  return parts.length > 0 ? parts.join(' • ') : undefined;
}

async function summaries(user: { id: string; is_super_admin?: boolean; user_type?: string }): Promise<PreparationSubjectSummary[]> {
  const parts = await listPartsForUser(user);
  const subjects = parts.parts.flatMap((part) =>
    part.subjects.map((subject) => ({
      id: subject.id,
      name: subject.name,
      name_bn: subject.name_bn,
      part_id: part.id,
      part_label: part.label,
      is_primary_part: part.is_primary,
      owned: subject.owned,
      owned_until: subject.owned_until,
    })),
  );
  const ids = subjects.map((subject) => subject.id).filter((id) => mongoose.isValidObjectId(id));
  const oids = ids.map(oid);
  if (oids.length === 0) return [];

  const partOids = [...new Set(subjects.map((s) => s.part_id).filter((id) => mongoose.isValidObjectId(id)))].map(oid);
  const now = new Date();

  const [
    bookRows,
    subjectQuestionRows,
    paperRows,
    pastClassRows,
    upcomingStreams,
    packages,
    livePrograms,
    liveEntitlements,
  ] = await Promise.all([
    BookSubjectLink.aggregate<{ _id: unknown; n: number }>([
      { $match: { exam_subject_id: { $in: oids }, is_active: true } },
      { $lookup: { from: 'books_info', localField: 'book_info_id', foreignField: '_id', as: 'book' } },
      { $unwind: '$book' },
      { $match: { 'book.is_published': true, 'book.is_active': true } },
      { $group: { _id: '$exam_subject_id', n: { $sum: 1 } } },
    ]),
    QuestionSubjectLink.aggregate<{
      _id: unknown;
      writtenIds: mongoose.Types.ObjectId[];
      mcqIds: mongoose.Types.ObjectId[];
    }>([
      { $match: { exam_subject_id: { $in: oids }, is_active: true } },
      { $lookup: { from: 'questions', localField: 'question_id', foreignField: '_id', as: 'question' } },
      { $unwind: '$question' },
      { $match: { 'question.is_published': true, 'question.is_active': true } },
      {
        $group: {
          _id: '$exam_subject_id',
          writtenIds: {
            $push: {
              $cond: [{ $in: ['$question.question_type_code', OBJECTIVE] }, '$$REMOVE', '$question._id'],
            },
          },
          mcqIds: {
            $push: {
              $cond: [{ $eq: ['$question.question_type_code', 'MCQ'] }, '$question._id', '$$REMOVE'],
            },
          },
        },
      },
    ]),
    PaperDetail.aggregate<{ _id: unknown; n: number }>([
      { $match: { exam_subject_id: { $in: oids }, is_published: true, is_active: true } },
      { $group: { _id: '$exam_subject_id', n: { $sum: 1 } } },
    ]),
    LiveStream.aggregate<{ _id: unknown; n: number }>([
      { $match: { exam_subject_id: { $in: oids }, is_active: true, status: 'ended' } },
      { $group: { _id: '$exam_subject_id', n: { $sum: 1 } } },
    ]),
    LiveStream.find({
      exam_subject_id: { $in: oids },
      is_active: true,
      status: { $in: ['scheduled', 'live', 'paused'] },
    })
      .select('exam_subject_id topic scheduled_at status access_type')
      .sort({ scheduled_at: 1 })
      .lean(),
    AccessPackage.find({
      is_deleted: false,
      is_active: true,
      kind: { $in: ['exam_prep', 'live'] },
      $or: [
        { exam_subject_id: { $in: oids } },
        { exam_subject_ids: { $in: oids } },
        {
          kind: 'exam_prep',
          exam_subject_id: null,
          'exam_subject_ids.0': { $exists: false },
          $or: [{ exam_part_id: { $in: partOids } }, { exam_part_id: null }],
        },
      ],
    })
      .select('name name_bn kind price duration_days description features class_limit live_program_id exam_part_id exam_subject_id exam_subject_ids sort_order')
      .sort({ sort_order: 1, price: 1 })
      .lean(),
    LiveProgram.find({ is_deleted: false, is_active: true }).select('name name_bn').lean(),
    mongoose.isValidObjectId(user.id)
      ? UserEntitlement.find({
          user_id: oid(user.id),
          kind: 'live',
          is_revoked: false,
          starts_at: { $lte: now },
          ends_at: { $gt: now },
        })
          .select('package_id exam_subject_id exam_subject_ids')
          .lean()
      : Promise.resolve([]),
  ]);

  const allQuestionOids = [
    ...new Set(
      subjectQuestionRows.flatMap((r) => [...r.writtenIds.map(String), ...r.mcqIds.map(String)]),
    ),
  ].map(oid);

  const userEvaluations =
    mongoose.isValidObjectId(user.id) && allQuestionOids.length > 0
      ? await UserQuestionEvaluation.find({
          user_id: oid(user.id),
          question_id: { $in: allQuestionOids },
        })
          .select('question_id read_count is_correct')
          .lean()
      : [];
  const evalByQuestion = new Map(userEvaluations.map((row) => [String(row.question_id), row]));

  const books = countMap(bookRows);
  const papers = countMap(paperRows);
  const past = countMap(pastClassRows);
  const questionsBySubject = new Map(subjectQuestionRows.map((row) => [String(row._id), row]));

  const upcomingCountBySubject = new Map<string, number>();
  const nextClassBySubject = new Map<string, PreparationNextClassBrief>();
  for (const stream of upcomingStreams) {
    if (!stream.exam_subject_id) continue;
    const sid = String(stream.exam_subject_id);
    upcomingCountBySubject.set(sid, (upcomingCountBySubject.get(sid) ?? 0) + 1);
    const existing = nextClassBySubject.get(sid);
    if (!existing || (stream.status === 'live' && existing.status !== 'live')) {
      nextClassBySubject.set(sid, {
        id: String(stream._id),
        topic: stream.topic,
        scheduled_at: new Date(stream.scheduled_at).toISOString(),
        status: stream.status,
        access_type: stream.access_type === 'paid' ? 'paid' : 'free',
      });
    }
  }

  const programNameById = new Map(
    livePrograms.map((p) => [String(p._id), p.name_bn?.trim() || p.name]),
  );

  const liveOwnedPackageIds = new Set(liveEntitlements.map((e) => String(e.package_id)));
  const liveOwnedSubjectIds = new Set<string>();
  for (const ent of liveEntitlements) {
    if (ent.exam_subject_id) liveOwnedSubjectIds.add(String(ent.exam_subject_id));
    for (const sid of ent.exam_subject_ids ?? []) liveOwnedSubjectIds.add(String(sid));
  }

  const packageBySubject = new Map<string, PreparationPackageBrief[]>();
  for (const pkg of packages) {
    const pkgId = String(pkg._id);
    const explicitSubjects = [
      pkg.exam_subject_id ? String(pkg.exam_subject_id) : '',
      ...(pkg.exam_subject_ids ?? []).map(String),
    ].filter(Boolean);

    if (pkg.kind === 'live' && liveOwnedPackageIds.has(pkgId)) {
      for (const sid of explicitSubjects) liveOwnedSubjectIds.add(sid);
    }

    const brief: PreparationPackageBrief = {
      id: pkgId,
      name: pkg.name,
      name_bn: pkg.name_bn,
      kind: pkg.kind,
      price: pkg.price,
      duration_days: pkg.duration_days,
      description: pkg.description,
      features: pkg.features,
      class_limit: pkg.class_limit,
      live_program_name: pkg.live_program_id ? programNameById.get(String(pkg.live_program_id)) : undefined,
      whole_part: explicitSubjects.length === 0,
    };

    const targets =
      explicitSubjects.length > 0
        ? explicitSubjects
        : subjects
            .filter((s) => (pkg.exam_part_id ? s.part_id === String(pkg.exam_part_id) : s.is_primary_part))
            .map((s) => s.id);

    for (const subjectId of targets) {
      const list = packageBySubject.get(subjectId) ?? [];
      if (!list.some((x) => x.id === brief.id)) {
        list.push(brief);
        packageBySubject.set(subjectId, list);
      }
    }
  }

  return subjects
    .map((subject) => {
      const qRow = questionsBySubject.get(subject.id);
      const writtenIds = qRow?.writtenIds ?? [];
      const mcqIds = qRow?.mcqIds ?? [];
      let writtenRead = 0;
      for (const qid of writtenIds) {
        const ev = evalByQuestion.get(String(qid));
        if ((ev?.read_count ?? 0) > 0) writtenRead += 1;
      }
      let mcqTouched = 0;
      let mcqCorrect = 0;
      let mcqWrong = 0;
      for (const qid of mcqIds) {
        const ev = evalByQuestion.get(String(qid));
        if (!ev || typeof ev.is_correct !== 'boolean') continue;
        mcqTouched += 1;
        if (ev.is_correct) mcqCorrect += 1;
        else mcqWrong += 1;
      }
      const totalItems = writtenIds.length + mcqIds.length;
      const doneItems = writtenRead + mcqTouched;
      const progressPercent = totalItems > 0 ? Math.min(100, Math.round((doneItems / totalItems) * 100)) : 0;

      return {
        id: subject.id,
        name: subject.name,
        name_bn: subject.name_bn,
        part_id: subject.part_id,
        part_label: subject.part_label,
        owned: subject.owned,
        owned_until: subject.owned_until,
        live_owned: parts.is_admin || liveOwnedSubjectIds.has(subject.id),
        books: books.get(subject.id) ?? 0,
        written: writtenIds.length,
        mcq: mcqIds.length,
        papers: papers.get(subject.id) ?? 0,
        past_classes: past.get(subject.id) ?? 0,
        upcoming_classes: upcomingCountBySubject.get(subject.id) ?? 0,
        written_read: writtenRead,
        mcq_touched: mcqTouched,
        mcq_correct: mcqCorrect,
        mcq_wrong: mcqWrong,
        progress_percent: progressPercent,
        next_class: nextClassBySubject.get(subject.id),
        packages: packageBySubject.get(subject.id) ?? [],
      };
    })
    .sort((a, b) => Number(b.owned) - Number(a.owned) || a.part_label.localeCompare(b.part_label) || a.name.localeCompare(b.name));
}

export async function listPreparationSubjects(user: {
  id: string;
  is_super_admin?: boolean;
  user_type?: string;
}): Promise<PreparationSubjectSummary[]> {
  return summaries(user);
}

async function subjectOrThrow(user: { id: string; is_super_admin?: boolean; user_type?: string }, subjectId: string) {
  if (!mongoose.isValidObjectId(subjectId)) throw notFound('Subject not found');
  const subject = (await summaries(user)).find((row) => row.id === subjectId);
  if (!subject) throw notFound('Subject not found');
  return subject;
}

/** Resolves primary chapter id for each question using both direct `book_chapter_id` and `QuestionBookLink`. */
async function resolveChapterIdsByQuestion(
  questions: Array<{ _id: mongoose.Types.ObjectId; book_chapter_id?: mongoose.Types.ObjectId }>,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const qOids = questions.map((q) => q._id);
  for (const q of questions) {
    if (q.book_chapter_id) map.set(String(q._id), String(q.book_chapter_id));
  }
  if (qOids.length > 0) {
    const bookLinks = await QuestionBookLink.find({
      question_id: { $in: qOids },
      is_active: true,
    })
      .select('question_id book_chapter_id sort_order')
      .sort({ sort_order: 1 })
      .lean();
    for (const link of bookLinks) {
      const qid = String(link.question_id);
      if (!map.has(qid) && link.book_chapter_id) {
        map.set(qid, String(link.book_chapter_id));
      }
    }
  }
  return map;
}

export interface WorkspaceQueryFilters {
  read?: 'all' | 'read' | 'unread';
  q?: string;
  book_id?: string;
}

export async function preparationWorkspace(
  user: { id: string; is_super_admin?: boolean; user_type?: string },
  subjectId: string,
  filters: WorkspaceQueryFilters = {},
): Promise<PreparationSubjectWorkspace> {
  const read = filters.read ?? 'all';
  const searchTerm = (filters.q ?? '').trim().toLowerCase();
  const filterBookId = filters.book_id?.trim() || '';

  const subject = await subjectOrThrow(user, subjectId);
  const subjectOid = oid(subjectId);

  const [bookLinks, qLinks] = await Promise.all([
    BookSubjectLink.find({ exam_subject_id: subjectOid, is_active: true })
      .select('book_info_id sort_order')
      .sort({ sort_order: 1 })
      .lean(),
    QuestionSubjectLink.find({ exam_subject_id: subjectOid, is_active: true }).select('question_id').lean(),
  ]);

  const subjectBookIds = bookLinks.map((link) => link.book_info_id);
  const questionIds = qLinks.map((link) => link.question_id);

  const [booksDocs, questions] = await Promise.all([
    BookInfo.find({ _id: { $in: subjectBookIds }, is_published: true, is_active: true })
      .select('name name_bn short_name edition publish_date effective_date is_superseded')
      .lean(),
    questionIds.length > 0
      ? Question.find({
          _id: { $in: questionIds },
          is_published: true,
          is_active: true,
        })
          .select('body_bn body_en question_type_code book_chapter_id')
          .lean()
      : Promise.resolve([]),
  ]);

  const chapterByQuestion = await resolveChapterIdsByQuestion(questions);

  // Load chapters for all subject books AND any chapters referenced by questions in this subject
  const referencedChapterOids = [...new Set([...chapterByQuestion.values()])]
    .filter((id) => mongoose.isValidObjectId(id))
    .map(oid);
  const publishedBookIdSet = new Set(booksDocs.map((b) => String(b._id)));

  const allChapterDocs = await BookChapter.find({
    is_active: true,
    $or: [
      ...(booksDocs.length > 0 ? [{ book_info_id: { $in: booksDocs.map((b) => b._id) } }] : []),
      ...(referencedChapterOids.length > 0 ? [{ _id: { $in: referencedChapterOids } }] : []),
    ],
  })
    .select('book_info_id name chapter_number sort_order')
    .sort({ sort_order: 1 })
    .lean();

  // Also fetch any extra published books referenced via question chapters so book names always resolve cleanly
  const extraBookIds = [
    ...new Set(
      allChapterDocs
        .map((c) => String(c.book_info_id))
        .filter((bid) => mongoose.isValidObjectId(bid) && !publishedBookIdSet.has(bid)),
    ),
  ].map(oid);
  const extraBooks =
    extraBookIds.length > 0
      ? await BookInfo.find({ _id: { $in: extraBookIds }, is_published: true, is_active: true })
          .select('name name_bn short_name edition publish_date effective_date is_superseded')
          .lean()
      : [];

  const bookMap = new Map(
    [...booksDocs, ...extraBooks].map((b) => [
      String(b._id),
      {
        id: String(b._id),
        name: b.name,
        name_bn: b.name_bn,
        short_name: b.short_name,
        edition: b.edition,
        publish_date: b.publish_date ? new Date(b.publish_date).toISOString() : undefined,
        effective_date: b.effective_date ? new Date(b.effective_date).toISOString() : undefined,
        is_superseded: Boolean(b.is_superseded),
      },
    ]),
  );

  const chapterMap = new Map(
    allChapterDocs.map((c) => [
      String(c._id),
      {
        id: String(c._id),
        book_id: String(c.book_info_id),
        name: c.name?.trim() || (c.chapter_number ? `অধ্যায় ${c.chapter_number}` : 'অধ্যায়'),
        chapter_number: c.chapter_number,
        sort_order: c.sort_order ?? 0,
      },
    ]),
  );

  // Tally written & MCQ counts per chapter for safe structural preview (even when locked!)
  const writtenCountByChapter = new Map<string, number>();
  const mcqCountByChapter = new Map<string, number>();
  for (const q of questions) {
    const cid = chapterByQuestion.get(String(q._id));
    if (!cid) continue;
    if (q.question_type_code === 'MCQ') {
      mcqCountByChapter.set(cid, (mcqCountByChapter.get(cid) ?? 0) + 1);
    } else if (!OBJECTIVE.includes(q.question_type_code)) {
      writtenCountByChapter.set(cid, (writtenCountByChapter.get(cid) ?? 0) + 1);
    }
  }

  // Ordered subject books for preview & unlocked workspace
  const bookOrder = subjectBookIds.map(String);
  const orderedSubjectBooks = booksDocs
    .slice()
    .sort((a, b) => bookOrder.indexOf(String(a._id)) - bookOrder.indexOf(String(b._id)));

  const preview_books: PreparationPreviewBook[] = orderedSubjectBooks.map((book) => {
    const bid = String(book._id);
    const chaps = allChapterDocs
      .filter((c) => String(c.book_info_id) === bid)
      .map((c) => {
        const cid = String(c._id);
        return {
          id: cid,
          name: c.name?.trim() || (c.chapter_number ? `অধ্যায় ${c.chapter_number}` : 'অধ্যায়'),
          chapter_number: c.chapter_number,
          written_count: writtenCountByChapter.get(cid) ?? 0,
          mcq_count: mcqCountByChapter.get(cid) ?? 0,
        };
      });
    return {
      id: bid,
      name: book.name,
      name_bn: book.name_bn,
      short_name: book.short_name,
      edition: book.edition,
      chapter_count: chaps.length,
      chapters: chaps,
    };
  });

  if (!subject.owned) {
    return {
      ...subject,
      locked: true,
      preview_books,
      books_list: [],
      written_questions: [],
      chapters: [],
      papers_list: [],
      classes: [],
    };
  }

  const [classes, evaluations, paperDocs] = await Promise.all([
    LiveStream.find({ exam_subject_id: subjectOid, is_active: true, status: { $ne: 'cancelled' } })
      .select('topic details scheduled_at status access_type')
      .sort({ scheduled_at: 1 })
      .lean(),
    mongoose.isValidObjectId(user.id) && questionIds.length > 0
      ? UserQuestionEvaluation.find({ user_id: oid(user.id), question_id: { $in: questionIds } })
          .select('question_id read_count last_read_at is_correct')
          .lean()
      : Promise.resolve([]),
    PaperDetail.find({ exam_subject_id: subjectOid, is_published: true, is_active: true })
      .select('name session_year total_marks pass_marks duration_minutes is_exam_of_week')
      .sort({ created_at: -1 })
      .lean(),
  ]);

  const paperQuestionCounts =
    paperDocs.length > 0
      ? await PaperQuestion.aggregate<{ _id: unknown; n: number }>([
          { $match: { paper_id: { $in: paperDocs.map((p) => p._id) }, is_active: true } },
          { $group: { _id: '$paper_id', n: { $sum: 1 } } },
        ])
      : [];
  const pqCountMap = countMap(paperQuestionCounts);

  const evalByQuestion = new Map(evaluations.map((row) => [String(row.question_id), row]));

  const writtenAll: PreparationWrittenRow[] = questions
    .filter((question) => !OBJECTIVE.includes(question.question_type_code))
    .map((question) => {
      const qid = String(question._id);
      const cid = chapterByQuestion.get(qid);
      const chap = cid ? chapterMap.get(cid) : undefined;
      const book = chap ? bookMap.get(chap.book_id) : undefined;
      const ev = evalByQuestion.get(qid);
      return {
        id: qid,
        title: plain(question.body_bn) || plain(question.body_en) || 'প্রশ্ন',
        question_type_code: question.question_type_code,
        book_id: book?.id,
        book_name: book ? book.name_bn?.trim() || book.name : undefined,
        chapter_id: chap?.id,
        chapter_name: chap?.name,
        read_count: ev?.read_count ?? 0,
        last_read_at: ev?.last_read_at ? new Date(ev.last_read_at).toISOString() : undefined,
      };
    });

  const written: PreparationWrittenRow[] = writtenAll
    .filter((row) => (read === 'read' ? row.read_count > 0 : read === 'unread' ? row.read_count === 0 : true))
    .filter((row) => (filterBookId ? row.book_id === filterBookId : true))
    .filter((row) => (searchTerm ? row.title.toLowerCase().includes(searchTerm) : true))
    .slice(0, WRITTEN_LIMIT);

  const mcqs = questions.filter((question) => question.question_type_code === 'MCQ');
  const mcqsByChapter = new Map<string, typeof mcqs>();
  for (const mcq of mcqs) {
    const cid = chapterByQuestion.get(String(mcq._id)) ?? UNASSIGNED_CHAPTER_ID;
    const resolvedCid = cid !== UNASSIGNED_CHAPTER_ID && chapterMap.has(cid) ? cid : UNASSIGNED_CHAPTER_ID;
    const list = mcqsByChapter.get(resolvedCid) ?? [];
    list.push(mcq);
    mcqsByChapter.set(resolvedCid, list);
  }

  const orderedChapterIds = allChapterDocs
    .map((c) => String(c._id))
    .filter((cid) => mcqsByChapter.has(cid));
  if (mcqsByChapter.has(UNASSIGNED_CHAPTER_ID)) {
    orderedChapterIds.push(UNASSIGNED_CHAPTER_ID);
  }

  const chapters: PreparationChapterRow[] = orderedChapterIds.map((cid) => {
    const rows = mcqsByChapter.get(cid) ?? [];
    let touched = 0;
    let correct = 0;
    let wrong = 0;
    for (const question of rows) {
      const mark = evalByQuestion.get(String(question._id));
      if (!mark || typeof mark.is_correct !== 'boolean') continue;
      touched += 1;
      if (mark.is_correct) correct += 1;
      else wrong += 1;
    }
    if (cid === UNASSIGNED_CHAPTER_ID) {
      return {
        id: UNASSIGNED_CHAPTER_ID,
        name: 'সাধারণ অনুশীলন (অন্যান্য MCQ)',
        mcq_total: rows.length,
        touched,
        correct,
        wrong,
      };
    }
    const chap = chapterMap.get(cid)!;
    const book = bookMap.get(chap.book_id);
    return {
      id: cid,
      name: chap.name,
      chapter_number: chap.chapter_number,
      book_id: book?.id,
      book_name: book ? book.name_bn?.trim() || book.name : undefined,
      mcq_total: rows.length,
      touched,
      correct,
      wrong,
    };
  });

  const books_list: PreparationBookRow[] = orderedSubjectBooks.map((book) => {
    const bid = String(book._id);
    const meta = bookMap.get(bid);
    const chapterCount = allChapterDocs.filter((c) => String(c.book_info_id) === bid).length;
    return {
      id: bid,
      name: book.name,
      name_bn: book.name_bn,
      short_name: book.short_name,
      edition: book.edition,
      publish_date: meta?.publish_date,
      effective_date: meta?.effective_date,
      is_superseded: meta?.is_superseded,
      chapter_count: chapterCount,
    };
  });

  const papers_list: PreparationPaperRow[] = paperDocs.map((p) => ({
    id: String(p._id),
    name: p.name,
    session_year: p.session_year,
    total_marks: p.total_marks,
    pass_marks: p.pass_marks,
    duration_minutes: p.duration_minutes,
    question_count: pqCountMap.get(String(p._id)) ?? 0,
    is_exam_of_week: p.is_exam_of_week,
  }));

  const classRows: PreparationClassRow[] = classes.map((row) => ({
    id: String(row._id),
    topic: row.topic,
    details: row.details ? plain(row.details) : undefined,
    scheduled_at: new Date(row.scheduled_at).toISOString(),
    status: row.status,
    access_type: row.access_type === 'paid' ? 'paid' : 'free',
    past: row.status === 'ended',
  }));

  return {
    ...subject,
    locked: false,
    preview_books,
    books_list,
    written_questions: written,
    chapters,
    papers_list,
    classes: classRows,
  };
}

export async function chapterPractice(
  user: { id: string; is_super_admin?: boolean; user_type?: string },
  subjectId: string,
  chapterId: string,
  wrongOnly: boolean,
): Promise<PreparationQuizQuestion[]> {
  const subject = await subjectOrThrow(user, subjectId);
  if (!subject.owned) throw forbidden('এই বিষয়ের কনটেন্ট খুলতে প্যাকেজে এনরোল করতে হবে।');
  if (chapterId !== UNASSIGNED_CHAPTER_ID && !mongoose.isValidObjectId(chapterId)) {
    throw notFound('Chapter not found');
  }

  const links = await QuestionSubjectLink.find({ exam_subject_id: oid(subjectId), is_active: true }).select('question_id').lean();
  const allMcqs = await Question.find({
    _id: { $in: links.map((link) => link.question_id) },
    question_type_code: 'MCQ',
    is_published: true,
    is_active: true,
  })
    .select('body_bn body_en marks book_chapter_id')
    .lean();

  const chapterByQuestion = await resolveChapterIdsByQuestion(allMcqs);
  let questions = allMcqs.filter((q) => {
    const cid = chapterByQuestion.get(String(q._id)) ?? UNASSIGNED_CHAPTER_ID;
    if (chapterId === UNASSIGNED_CHAPTER_ID) return cid === UNASSIGNED_CHAPTER_ID;
    return cid === chapterId;
  });

  const qOids = questions.map((q) => q._id);
  const marks =
    mongoose.isValidObjectId(user.id) && qOids.length > 0
      ? await UserQuestionEvaluation.find({
          user_id: oid(user.id),
          question_id: { $in: qOids },
        })
          .select('question_id selected_option_id is_correct')
          .lean()
      : [];
  const evalMap = new Map(marks.map((m) => [String(m.question_id), m]));

  if (wrongOnly) {
    questions = questions.filter((q) => evalMap.get(String(q._id))?.is_correct === false);
  }

  const finalOids = questions.map((q) => q._id);
  if (finalOids.length === 0) return [];

  const [optionsDocs, answerDocs, detailDocs] = await Promise.all([
    QuestionOption.find({ question_id: { $in: finalOids } }).sort({ option_key: 1 }).lean(),
    QuestionAnswer.find({ question_id: { $in: finalOids }, is_correct: true }).select('question_id option_id').lean(),
    QuestionAnswerDetail.find({ question_id: { $in: finalOids } })
      .select('question_id explanation explanation_sections note')
      .lean(),
  ]);

  const optionsByQ = new Map<string, typeof optionsDocs>();
  for (const opt of optionsDocs) {
    const qid = String(opt.question_id);
    const list = optionsByQ.get(qid) ?? [];
    list.push(opt);
    optionsByQ.set(qid, list);
  }
  const correctByQ = new Map(answerDocs.map((a) => [String(a.question_id), String(a.option_id)]));
  const detailByQ = new Map(detailDocs.map((d) => [String(d.question_id), d]));

  return questions.map((question) => {
    const qid = String(question._id);
    const opts = optionsByQ.get(qid) ?? [];
    const prev = evalMap.get(qid);
    return {
      id: qid,
      title: plain(question.body_bn) || plain(question.body_en) || 'MCQ',
      marks: question.marks ?? 1,
      options: opts.map((o) => ({
        id: String(o._id),
        key: o.option_key,
        text: plain(o.option_text_bn) || plain(o.option_text_en) || o.option_key,
      })),
      correct_option_id: correctByQ.get(qid),
      explanation: extractExplanationText(detailByQ.get(qid)),
      previous_selected_option_id: prev?.selected_option_id ? String(prev.selected_option_id) : undefined,
      previous_is_correct: typeof prev?.is_correct === 'boolean' ? prev.is_correct : undefined,
    };
  });
}
