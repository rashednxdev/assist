import type { QuestionLinkLevel } from '@ibas/shared-constants';
import { emptyBookLinkForm, type QuestionBookLinkForm } from '@/components/questions/question-book-links-editor';

export interface QuestionBookContext {
  bookId: string;
  chapterId: string;
  linkLevel: QuestionLinkLevel;
  topicId: string;
  subTopicId: string;
  hasPreset: boolean;
}

export function parseQuestionBookContext(
  searchParams: Pick<URLSearchParams, 'get'>,
): QuestionBookContext {
  const bookId = searchParams.get('book_id') ?? '';
  const chapterId = searchParams.get('chapter_id') ?? '';
  const linkLevel = (searchParams.get('link_level') ?? 'chapter') as QuestionLinkLevel;
  const topicId = searchParams.get('topic_id') ?? '';
  const subTopicId = searchParams.get('sub_topic_id') ?? '';
  return {
    bookId,
    chapterId,
    linkLevel,
    topicId,
    subTopicId,
    hasPreset: Boolean(bookId && chapterId),
  };
}

export function buildPresetBookLink(ctx: QuestionBookContext): QuestionBookLinkForm {
  return {
    ...emptyBookLinkForm(),
    link_level: ctx.linkLevel,
    book_id: ctx.bookId,
    book_chapter_id: ctx.chapterId,
    book_topic_id: ctx.topicId,
    book_sub_topic_id: ctx.subTopicId,
  };
}

export function buildNewQuestionHref(ctx: Pick<QuestionBookContext, 'bookId' | 'chapterId' | 'linkLevel' | 'topicId' | 'subTopicId'>) {
  const params = new URLSearchParams();
  if (ctx.bookId) params.set('book_id', ctx.bookId);
  if (ctx.chapterId) params.set('chapter_id', ctx.chapterId);
  if (ctx.linkLevel) params.set('link_level', ctx.linkLevel);
  if (ctx.topicId) params.set('topic_id', ctx.topicId);
  if (ctx.subTopicId) params.set('sub_topic_id', ctx.subTopicId);
  return `/questions/new?${params.toString()}`;
}

export function bookLinkPayloadFromContext(ctx: QuestionBookContext) {
  return {
    link_level: ctx.linkLevel,
    book_chapter_id: ctx.chapterId,
    book_topic_id: ctx.topicId || undefined,
    book_sub_topic_id: ctx.subTopicId || undefined,
  };
}
