import { apiFetch } from './api';
import {
  cacheBookReaderFull,
  cacheBookReaderOutline,
  cacheTopicDetail,
  getInflightFull,
  getInflightOutline,
  getInflightTopic,
  setInflightFull,
  setInflightOutline,
  setInflightTopic,
} from './book-cache';
import type {
  BookListItem,
  BookReaderOutline,
  ReaderChapter,
  ReaderChapterFull,
  ReaderTopicFull,
  RegulationDetail,
  RegulationSearchRow,
  TopicDetail,
} from '@/types/books';

async function fetchBookReaderOutlineRaw(bookId: string) {
  const res = await apiFetch<{ data: BookReaderOutline }>(`/books/${bookId}/reader-outline`);
  return res.data;
}

async function fetchTopicDetailRaw(topicId: string) {
  const res = await apiFetch<{ data: TopicDetail }>(`/books/topics/${topicId}`);
  return res.data;
}

export async function fetchBooks(params?: {
  q?: string;
  book_type_id?: string;
  exam_subject_id?: string;
}) {
  const search = new URLSearchParams();
  if (params?.q?.trim()) search.set('q', params.q.trim());
  if (params?.book_type_id) search.set('book_type_id', params.book_type_id);
  if (params?.exam_subject_id) search.set('exam_subject_id', params.exam_subject_id);
  const qs = search.toString();
  const res = await apiFetch<{ data: BookListItem[] }>(`/books${qs ? `?${qs}` : ''}`);
  return res.data;
}

export async function fetchBookSubjectCatalog() {
  const res = await apiFetch<{
    data: Array<{ id: string; name: string; name_bn?: string; label: string }>;
  }>('/books/subject-catalog');
  return res.data;
}

/**
 * Always hits the network (deduped via inflight tracking) — callers that want an instant
 * cache-first paint should read `peekBookReaderOutline` themselves first, then call this to
 * revalidate. This function must never short-circuit on a cache hit, since it backs explicit
 * reloads (e.g. reopening a book screen) that need to pick up server-side edits promptly rather
 * than silently serving up-to-30-minute-stale content.
 */
export async function fetchBookReaderOutline(bookId: string) {
  const inflight = getInflightOutline(bookId);
  if (inflight) return inflight;

  const promise = fetchBookReaderOutlineRaw(bookId).then((data) => {
    cacheBookReaderOutline(bookId, data);
    return data;
  });
  setInflightOutline(bookId, promise);
  return promise;
}

function toReaderTopicFull(topic: ReaderChapter['topics'][number], detail?: TopicDetail): ReaderTopicFull {
  return {
    ...topic,
    description: detail?.description,
    note: detail?.note,
    content_link: detail?.content_link,
    table: detail?.table,
    processes: detail?.processes,
    details: detail?.details ?? [],
    sub_topics: detail?.sub_topics ?? [],
  };
}

async function enrichChaptersFromTopicDetails(
  outlineChapters: ReaderChapter[],
): Promise<ReaderChapterFull[]> {
  const topicIds = outlineChapters.flatMap((c) => c.topics.map((t) => t.id));
  if (topicIds.length === 0) {
    return outlineChapters.map((chapter) => ({ ...chapter, topics: [] }));
  }

  const details = await Promise.all(topicIds.map((id) => fetchTopicDetail(id)));
  const detailById = new Map(details.map((d) => [d.id, d]));

  return outlineChapters.map((chapter) => ({
    ...chapter,
    topics: chapter.topics.map((topic) => toReaderTopicFull(topic, detailById.get(topic.id))),
  }));
}

function hasEnrichedTopics(chapters: ReaderChapterFull[]) {
  return chapters.some((chapter) =>
    chapter.topics.some(
      (topic) =>
        Boolean(topic.description?.trim()) ||
        Boolean(topic.note?.trim()) ||
        Boolean(topic.content_link?.trim()) ||
        (topic.details?.length ?? 0) > 0 ||
        (topic.sub_topics?.length ?? 0) > 0,
    ),
  );
}

async function fetchBookReaderFullRaw(bookId: string, outlineChapters: ReaderChapter[]) {
  try {
    const res = await apiFetch<{ data: BookReaderOutline & { chapters: ReaderChapterFull[] } }>(
      `/books/${bookId}/reader-full`,
    );
    const chapters = res.data?.chapters ?? [];
    if (chapters.length > 0 && hasEnrichedTopics(chapters)) {
      return chapters;
    }
  } catch {
    /* fall back to per-topic fetch */
  }

  return enrichChaptersFromTopicDetails(outlineChapters);
}

/** Always hits the network (deduped via inflight tracking) — see fetchBookReaderOutline's note. */
export async function fetchBookReaderFull(bookId: string, outlineChapters: ReaderChapter[]) {
  const inflight = getInflightFull(bookId);
  if (inflight) return inflight;

  const promise = fetchBookReaderFullRaw(bookId, outlineChapters).then((data) => {
    cacheBookReaderFull(bookId, data);
    return data;
  });
  setInflightFull(bookId, promise);
  return promise;
}

/** Always hits the network (deduped via inflight tracking) — see fetchBookReaderOutline's note. */
export async function fetchTopicDetail(topicId: string) {
  const inflight = getInflightTopic(topicId);
  if (inflight) return inflight;

  const promise = fetchTopicDetailRaw(topicId).then((data) => {
    cacheTopicDetail(topicId, data);
    return data;
  });
  setInflightTopic(topicId, promise);
  return promise;
}

export async function searchRegulations(params?: { q?: string; limit?: number }) {
  const search = new URLSearchParams();
  if (params?.q?.trim()) search.set('q', params.q.trim());
  if (params?.limit) search.set('limit', String(params.limit));
  const qs = search.toString();
  const res = await apiFetch<{ data: RegulationSearchRow[] }>(
    `/books/regulations/search${qs ? `?${qs}` : ''}`,
  );
  return res.data;
}

export async function fetchRegulationDetail(id: string) {
  const res = await apiFetch<{ data: RegulationDetail }>(`/books/regulations/${id}`);
  return res.data;
}

export { peekBookReaderFull, peekBookReaderOutline } from './book-cache';
