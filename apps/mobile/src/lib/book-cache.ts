import type { BookReaderOutline, ReaderChapterFull, TopicDetail } from '@/types/books';

type CacheEntry<T> = { data: T; at: number };

const TTL_MS = 30 * 60 * 1000;

const outlineCache = new Map<string, CacheEntry<BookReaderOutline>>();
const fullCache = new Map<string, CacheEntry<ReaderChapterFull[]>>();
const topicCache = new Map<string, CacheEntry<TopicDetail>>();

const inflightOutline = new Map<string, Promise<BookReaderOutline>>();
const inflightFull = new Map<string, Promise<ReaderChapterFull[]>>();
const inflightTopic = new Map<string, Promise<TopicDetail>>();

function isFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return Boolean(entry && Date.now() - entry.at < TTL_MS);
}

export function peekBookReaderOutline(bookId: string): BookReaderOutline | null {
  const entry = outlineCache.get(bookId);
  return isFresh(entry) ? entry.data : null;
}

export function peekBookReaderFull(bookId: string): ReaderChapterFull[] | null {
  const entry = fullCache.get(bookId);
  return isFresh(entry) ? entry.data : null;
}

export function peekTopicDetail(topicId: string): TopicDetail | null {
  const entry = topicCache.get(topicId);
  return isFresh(entry) ? entry.data : null;
}

export function cacheBookReaderOutline(bookId: string, data: BookReaderOutline) {
  outlineCache.set(bookId, { data, at: Date.now() });
}

export function cacheBookReaderFull(bookId: string, data: ReaderChapterFull[]) {
  fullCache.set(bookId, { data, at: Date.now() });
}

export function cacheTopicDetail(topicId: string, data: TopicDetail) {
  topicCache.set(topicId, { data, at: Date.now() });
}

export function getInflightOutline(bookId: string) {
  return inflightOutline.get(bookId);
}

export function setInflightOutline(bookId: string, promise: Promise<BookReaderOutline>) {
  inflightOutline.set(bookId, promise);
  promise.finally(() => {
    if (inflightOutline.get(bookId) === promise) {
      inflightOutline.delete(bookId);
    }
  });
}

export function getInflightFull(bookId: string) {
  return inflightFull.get(bookId);
}

export function setInflightFull(bookId: string, promise: Promise<ReaderChapterFull[]>) {
  inflightFull.set(bookId, promise);
  promise.finally(() => {
    if (inflightFull.get(bookId) === promise) {
      inflightFull.delete(bookId);
    }
  });
}

export function getInflightTopic(topicId: string) {
  return inflightTopic.get(topicId);
}

export function setInflightTopic(topicId: string, promise: Promise<TopicDetail>) {
  inflightTopic.set(topicId, promise);
  promise.finally(() => {
    if (inflightTopic.get(topicId) === promise) {
      inflightTopic.delete(topicId);
    }
  });
}
