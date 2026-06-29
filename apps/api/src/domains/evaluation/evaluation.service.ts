import mongoose from 'mongoose';
import {
  OBJECTIVE_QUESTION_TYPE_CODES,
  SELF_RATING_PROGRESS,
  type SelfRatingLevel,
} from '@ibas/shared-constants';
import type { UpsertQuestionEvaluationDto } from '@ibas/shared-types';
import { Question } from '../questions/models/Question.model.js';
import { QuestionOption } from '../questions/models/QuestionOption.model.js';
import { QuestionAnswer } from '../questions/models/QuestionAnswer.model.js';
import { QuestionBookLink } from '../questions/models/QuestionBookLink.model.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { BookChapter } from '../books/models/BookChapter.model.js';
import { BookTopic } from '../books/models/BookTopic.model.js';
import { BookSubTopic } from '../books/models/BookSubTopic.model.js';
import { PaperDetail } from '../papers/models/PaperDetail.model.js';
import { PaperGroup } from '../papers/models/PaperGroup.model.js';
import { PaperQuestion } from '../papers/models/PaperQuestion.model.js';
import { ChildQuestion } from '../papers/models/ChildQuestion.model.js';
import { UserQuestionEvaluation } from './models/UserQuestionEvaluation.model.js';
import { notFound, badRequest, forbidden } from '../../shared/errors/AppError.js';

function idStr(v: mongoose.Types.ObjectId | string | undefined) {
  return v ? String(v) : undefined;
}

function isObjectiveType(code: string | undefined) {
  return OBJECTIVE_QUESTION_TYPE_CODES.includes(code as (typeof OBJECTIVE_QUESTION_TYPE_CODES)[number]);
}

function summarize(
  questionIds: string[],
  progressMap: Map<string, number>,
  ratedSet: Set<string>,
) {
  const uniqueIds = [...new Set(questionIds)];
  const total = uniqueIds.length;
  if (total === 0) {
    return { total_questions: 0, rated_questions: 0, progress_percent: 0 };
  }
  let sum = 0;
  let rated = 0;
  for (const id of uniqueIds) {
    if (ratedSet.has(id)) rated += 1;
    sum += progressMap.get(id) ?? 0;
  }
  return {
    total_questions: total,
    rated_questions: rated,
    progress_percent: Math.round(sum / total),
  };
}

async function loadProgressMap(userId: string, questionIds: string[]) {
  const unique = [...new Set(questionIds)];
  const progressMap = new Map<string, number>();
  const ratedSet = new Set<string>();
  if (unique.length === 0) return { progressMap, ratedSet };

  const rows = await UserQuestionEvaluation.find({
    user_id: userId,
    question_id: { $in: unique },
  });
  for (const row of rows) {
    const id = String(row.question_id);
    progressMap.set(id, row.progress_index);
    ratedSet.add(id);
  }
  return { progressMap, ratedSet };
}

async function publishedQuestionIds(ids: string[]) {
  if (ids.length === 0) return [];
  const questions = await Question.find({
    _id: { $in: ids },
    is_active: true,
    is_published: true,
  }).select('_id');
  return questions.map((q) => String(q._id));
}

function serializeEvaluation(row: InstanceType<typeof UserQuestionEvaluation>) {
  return {
    question_id: String(row.question_id),
    progress_index: row.progress_index,
    is_correct: row.is_correct,
    self_rating: row.self_rating,
    selected_option_id: idStr(row.selected_option_id),
    updated_at: row.updated_at.toISOString(),
  };
}

export async function getQuestionEvaluation(userId: string, questionId: string) {
  const row = await UserQuestionEvaluation.findOne({ user_id: userId, question_id: questionId });
  if (!row) {
    return {
      question_id: questionId,
      progress_index: 0,
    };
  }
  return serializeEvaluation(row);
}

export async function getQuestionEvaluationsBatch(userId: string, questionIds: string[]) {
  const unique = [...new Set(questionIds.filter(Boolean))];
  const rows = await UserQuestionEvaluation.find({
    user_id: userId,
    question_id: { $in: unique },
  });
  const byId = new Map(rows.map((r) => [String(r.question_id), serializeEvaluation(r)]));
  return unique.map((id) => byId.get(id) ?? { question_id: id, progress_index: 0 });
}

export async function getQuestionPracticeStem(questionId: string) {
  const question = await Question.findById(questionId);
  if (!question || !question.is_active || !question.is_published) {
    throw notFound('Question not found');
  }

  const options = await QuestionOption.find({ question_id: question._id }).sort({ option_key: 1 });

  return {
    id: String(question._id),
    body_en: question.body_en,
    body_bn: question.body_bn,
    marks: question.marks,
    question_type_code: question.question_type_code,
    has_options: isObjectiveType(question.question_type_code),
    options: options.map((o) => ({
      id: String(o._id),
      option_key: o.option_key,
      option_text_en: o.option_text_en,
      option_text_bn: o.option_text_bn,
    })),
  };
}

export async function upsertQuestionEvaluation(
  userId: string,
  questionId: string,
  dto: UpsertQuestionEvaluationDto,
) {
  const question = await Question.findById(questionId);
  if (!question || !question.is_active || !question.is_published) {
    throw notFound('Question not found');
  }

  const objective = isObjectiveType(question.question_type_code);
  let progress_index = 0;
  let selected_option_id: mongoose.Types.ObjectId | undefined;
  let is_correct: boolean | undefined;
  let self_rating: SelfRatingLevel | undefined;

  if (objective) {
    if (!dto.selected_option_id) {
      throw badRequest('Select an option for this question');
    }
    const option = await QuestionOption.findOne({
      _id: dto.selected_option_id,
      question_id: question._id,
    });
    if (!option) throw badRequest('Invalid option for this question');

    const answer = await QuestionAnswer.findOne({
      question_id: question._id,
      option_id: option._id,
    });
    is_correct = answer?.is_correct === true;
    progress_index = is_correct ? 100 : 0;
    selected_option_id = option._id;
  } else {
    if (!dto.self_rating) {
      throw badRequest('Select a self-rating level for this question');
    }
    self_rating = dto.self_rating;
    progress_index = SELF_RATING_PROGRESS[self_rating];
  }

  const row = await UserQuestionEvaluation.findOneAndUpdate(
    { user_id: userId, question_id: question._id },
    {
      user_id: userId,
      question_id: question._id,
      selected_option_id,
      is_correct,
      self_rating,
      progress_index,
      updated_at: new Date(),
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return serializeEvaluation(row);
}

async function getBookQuestionLinks(bookId: string) {
  const book = await BookInfo.findById(bookId);
  if (!book || !book.is_active) throw notFound('Book not found');

  const chapters = await BookChapter.find({ book_info_id: bookId, is_active: true }).sort({
    sort_order: 1,
  });
  const chapterIds = chapters.map((c) => c._id);
  if (chapterIds.length === 0) {
    return { book, chapters: [], topics: [], subTopics: [], links: [] };
  }

  const topics = await BookTopic.find({ book_chapter_id: { $in: chapterIds }, is_active: true }).sort({
    sort_order: 1,
  });
  const topicIds = topics.map((t) => t._id);
  const subTopics =
    topicIds.length > 0
      ? await BookSubTopic.find({ book_topic_id: { $in: topicIds }, is_active: true }).sort({
          sort_order: 1,
        })
      : [];

  const links = await QuestionBookLink.find({
    book_chapter_id: { $in: chapterIds },
    is_active: true,
  });

  const linkedQuestionIds = [...new Set(links.map((l) => String(l.question_id)))];
  const publishedIds = new Set(await publishedQuestionIds(linkedQuestionIds));
  const activeLinks = links.filter((l) => publishedIds.has(String(l.question_id)));

  return { book, chapters, topics, subTopics, links: activeLinks };
}

function questionsForSubTopic(
  subTopicId: string,
  links: InstanceType<typeof QuestionBookLink>[],
) {
  return [
    ...new Set(
      links
        .filter((l) => l.link_level === 'sub_rule' && String(l.book_sub_topic_id) === subTopicId)
        .map((l) => String(l.question_id)),
    ),
  ];
}

function questionsForTopic(
  topicId: string,
  subTopicIds: string[],
  links: InstanceType<typeof QuestionBookLink>[],
) {
  const direct = links
    .filter((l) => l.link_level === 'rule' && String(l.book_topic_id) === topicId)
    .map((l) => String(l.question_id));
  const fromSubs = subTopicIds.flatMap((sid) => questionsForSubTopic(sid, links));
  return [...new Set([...direct, ...fromSubs])];
}

function questionsForChapter(
  chapterId: string,
  topicIds: string[],
  subTopicsByTopic: Map<string, string[]>,
  links: InstanceType<typeof QuestionBookLink>[],
) {
  const direct = links
    .filter((l) => l.link_level === 'chapter' && String(l.book_chapter_id) === chapterId)
    .map((l) => String(l.question_id));
  const fromTopics = topicIds.flatMap((tid) =>
    questionsForTopic(tid, subTopicsByTopic.get(tid) ?? [], links),
  );
  return [...new Set([...direct, ...fromTopics])];
}

export async function getBookEvaluation(userId: string, bookId: string) {
  const { book, chapters, topics, subTopics, links } = await getBookQuestionLinks(bookId);

  const topicsByChapter = new Map<string, InstanceType<typeof BookTopic>[]>();
  for (const topic of topics) {
    const cid = String(topic.book_chapter_id);
    const list = topicsByChapter.get(cid) ?? [];
    list.push(topic);
    topicsByChapter.set(cid, list);
  }

  const subTopicsByTopic = new Map<string, InstanceType<typeof BookSubTopic>[]>();
  for (const sub of subTopics) {
    const tid = String(sub.book_topic_id);
    const list = subTopicsByTopic.get(tid) ?? [];
    list.push(sub);
    subTopicsByTopic.set(tid, list);
  }

  const subTopicsByTopicIds = new Map<string, string[]>();
  for (const [tid, subs] of subTopicsByTopic) {
    subTopicsByTopicIds.set(
      tid,
      subs.map((s) => String(s._id)),
    );
  }

  const allQuestionIds = [...new Set(links.map((l) => String(l.question_id)))];
  const { progressMap, ratedSet } = await loadProgressMap(userId, allQuestionIds);

  const chapterNodes = chapters.map((chapter) => {
    const chapterId = String(chapter._id);
    const chapterTopics = topicsByChapter.get(chapterId) ?? [];
    const topicIds = chapterTopics.map((t) => String(t._id));

    const topicNodes = chapterTopics.map((topic) => {
      const topicId = String(topic._id);
      const topicSubs = subTopicsByTopic.get(topicId) ?? [];

      const subNodes = topicSubs.map((sub) => {
        const subId = String(sub._id);
        const qIds = questionsForSubTopic(subId, links);
        return {
          id: subId,
          name: sub.name ?? sub.rule_number ?? 'Sub-topic',
          type: 'sub_topic' as const,
          rule_number: sub.rule_number,
          ...summarize(qIds, progressMap, ratedSet),
        };
      });

      const topicQIds = questionsForTopic(
        topicId,
        topicSubs.map((s) => String(s._id)),
        links,
      );

      return {
        id: topicId,
        name: topic.name,
        type: 'topic' as const,
        rule_number: topic.rule_number,
        ...summarize(topicQIds, progressMap, ratedSet),
        children: subNodes.length > 0 ? subNodes : undefined,
      };
    });

    const chapterQIds = questionsForChapter(chapterId, topicIds, subTopicsByTopicIds, links);

    return {
      id: chapterId,
      name: chapter.name,
      type: 'chapter' as const,
      rule_number: chapter.chapter_number,
      ...summarize(chapterQIds, progressMap, ratedSet),
      children: topicNodes.length > 0 ? topicNodes : undefined,
    };
  });

  return {
    book: {
      id: String(book._id),
      name: book.name,
      short_name: book.short_name,
    },
    overall: {
      id: String(book._id),
      name: book.name,
      type: 'book' as const,
      ...summarize(allQuestionIds, progressMap, ratedSet),
      children: chapterNodes,
    },
  };
}

async function getPaperQuestionIds(paperId: string) {
  const paper = await PaperDetail.findById(paperId);
  if (!paper || !paper.is_active) throw notFound('Paper not found');
  if (!paper.is_published) throw forbidden('Paper is not published');

  const groups = await PaperGroup.find({ paper_id: paperId, is_active: true }).sort({ group_number: 1 });
  const questions = await PaperQuestion.find({ paper_id: paperId, is_active: true }).sort({
    question_number: 1,
  });
  const pqIds = questions.map((q) => q._id);
  const children = await ChildQuestion.find({
    paper_question_id: { $in: pqIds },
    is_active: true,
  });

  function idsForPaperQuestion(pq: InstanceType<typeof PaperQuestion>) {
    if (pq.from_question_bank !== false && pq.question_id) {
      return [String(pq.question_id)];
    }
    return children
      .filter((c) => String(c.paper_question_id) === String(pq._id))
      .map((c) => String(c.question_id));
  }

  const grouped = groups.map((group) => {
    const groupQuestions = questions.filter((q) => String(q.paper_group_id) === String(group._id));
    const questionNodes = groupQuestions.map((pq) => {
      const qIds = idsForPaperQuestion(pq);
      return {
        pq,
        qIds,
      };
    });
    return { group, questionNodes };
  });

  const ungrouped = questions.filter((q) => !q.paper_group_id);
  const ungroupedNodes = ungrouped.map((pq) => ({
    pq,
    qIds: idsForPaperQuestion(pq),
  }));

  const allRawIds = [
    ...grouped.flatMap((g) => g.questionNodes.flatMap((n) => n.qIds)),
    ...ungroupedNodes.flatMap((n) => n.qIds),
  ];
  const published = await publishedQuestionIds(allRawIds);
  const publishedSet = new Set(published);

  function filterPublished(ids: string[]) {
    return ids.filter((id) => publishedSet.has(id));
  }

  return {
    paper,
    groups,
    grouped: grouped.map((g) => ({
      group: g.group,
      questionNodes: g.questionNodes.map((n) => ({
        pq: n.pq,
        qIds: filterPublished(n.qIds),
      })),
    })),
    ungroupedNodes: ungroupedNodes.map((n) => ({
      pq: n.pq,
      qIds: filterPublished(n.qIds),
    })),
    allQuestionIds: [...new Set(published)],
  };
}

export async function getPaperEvaluation(userId: string, paperId: string) {
  const { paper, grouped, ungroupedNodes, allQuestionIds } = await getPaperQuestionIds(paperId);
  const { progressMap, ratedSet } = await loadProgressMap(userId, allQuestionIds);

  const groupNodes = grouped.map(({ group, questionNodes }) => {
    const groupQIds = questionNodes.flatMap((n) => n.qIds);
    const children = questionNodes
      .filter((n) => n.qIds.length > 0)
      .map(({ pq, qIds }) => ({
        id: String(pq._id),
        name: pq.header_text?.trim() || `Question ${pq.display_question_number ?? pq.question_number}`,
        type: 'question' as const,
        question_number: pq.question_number,
        display_question_number: pq.display_question_number,
        ...summarize(qIds, progressMap, ratedSet),
      }));

    return {
      id: String(group._id),
      name: group.name,
      type: 'group' as const,
      ...summarize(groupQIds, progressMap, ratedSet),
      children: children.length > 0 ? children : undefined,
    };
  });

  const ungroupedChildren = ungroupedNodes
    .filter((n) => n.qIds.length > 0)
    .map(({ pq, qIds }) => ({
      id: String(pq._id),
      name: pq.header_text?.trim() || `Question ${pq.display_question_number ?? pq.question_number}`,
      type: 'question' as const,
      question_number: pq.question_number,
      display_question_number: pq.display_question_number,
      ...summarize(qIds, progressMap, ratedSet),
    }));

  const ungroupedQIds = ungroupedNodes.flatMap((n) => n.qIds);

  return {
    paper: {
      id: String(paper._id),
      name: paper.name,
      total_marks: paper.total_marks,
      pass_marks: paper.pass_marks,
    },
    overall: {
      id: String(paper._id),
      name: paper.name,
      type: 'paper' as const,
      ...summarize(allQuestionIds, progressMap, ratedSet),
      children: [
        ...groupNodes,
        ...(ungroupedChildren.length > 0
          ? [
              {
                id: 'ungrouped',
                name: 'Ungrouped questions',
                type: 'group' as const,
                ...summarize(ungroupedQIds, progressMap, ratedSet),
                children: ungroupedChildren,
              },
            ]
          : []),
      ],
    },
  };
}
