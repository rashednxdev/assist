import { listBooks } from '../books/books.service.js';
import { listExamNames } from '../exams/exams.service.js';
import { listPapers } from '../papers/papers.service.js';
import { listQuestions } from '../questions/questions.service.js';
import { BookInfo } from '../books/models/BookInfo.model.js';
import { Question } from '../questions/models/Question.model.js';
import { ExamName } from '../exams/models/ExamName.model.js';
import { PaperDetail } from '../papers/models/PaperDetail.model.js';
import { logger } from '../../shared/logger.js';
import {
  CONTENT_CACHE_KEYS,
  getCacheStatus,
  getCached,
  getCachedBuiltAt,
  setCached,
  type ContentCacheKey,
  type LearningStatsCache,
} from './cache-store.js';

export type { LearningStatsCache, ContentCacheKey };

async function buildPublishedQuestions() {
  const all: unknown[] = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const page = await listQuestions(
      {
        is_published: true,
        limit,
        offset,
      },
      { bypassCache: true },
    );
    all.push(...page.items);
    offset += page.items.length;
    if (page.items.length === 0 || offset >= page.total) break;
  }
  return all;
}

export async function rebuildContentCache(keys?: ContentCacheKey[]) {
  const target = keys?.length ? keys : [...CONTENT_CACHE_KEYS];
  const started = Date.now();
  const results: Array<{ key: ContentCacheKey; ok: boolean; count?: number; error?: string }> = [];

  for (const key of target) {
    try {
      if (key === 'learning.stats') {
        const [books, questions, exams, papers] = await Promise.all([
          BookInfo.countDocuments({ is_active: true, is_superseded: false }),
          Question.countDocuments({ is_active: true, is_published: true }),
          ExamName.countDocuments({ is_active: true }),
          PaperDetail.countDocuments({ is_active: true, is_published: true }),
        ]);
        const data: LearningStatsCache = {
          books,
          questions,
          exams,
          papers,
          built_at: new Date().toISOString(),
        };
        await setCached(key, data);
        results.push({ key, ok: true, count: 4 });
      } else if (key === 'books.list') {
        const data = await listBooks({}, { bypassCache: true });
        await setCached(key, data);
        results.push({ key, ok: true, count: data.length });
      } else if (key === 'exams.names') {
        const data = await listExamNames(undefined, { bypassCache: true });
        await setCached(key, data);
        results.push({ key, ok: true, count: data.length });
      } else if (key === 'papers.published') {
        const data = await listPapers({}, { publishedOnly: true, bypassCache: true });
        await setCached(key, data);
        results.push({ key, ok: true, count: data.length });
      } else if (key === 'questions.published') {
        const data = await buildPublishedQuestions();
        await setCached(key, data);
        results.push({ key, ok: true, count: data.length });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Rebuild failed';
      logger.error({ err, key }, 'Content cache rebuild failed for key');
      results.push({ key, ok: false, error: message });
    }
  }

  return {
    rebuilt_at: new Date().toISOString(),
    duration_ms: Date.now() - started,
    results,
    status: await getCacheStatus(),
  };
}

export async function contentCacheStatus() {
  return {
    status: await getCacheStatus(),
    keys: CONTENT_CACHE_KEYS,
  };
}

export function cachedLearningStats(): LearningStatsCache | null {
  return getCached<LearningStatsCache>('learning.stats');
}

export function cachedBooksList<T = unknown>(): T[] | null {
  return getCached<T[]>('books.list');
}

export function cachedExamNames<T = unknown>(): T[] | null {
  return getCached<T[]>('exams.names');
}

export function cachedPublishedPapers<T = unknown>(): T[] | null {
  return getCached<T[]>('papers.published');
}

export function cachedPublishedQuestions<T = unknown>(): T[] | null {
  return getCached<T[]>('questions.published');
}

export function cacheFreshness(key: ContentCacheKey): string | null {
  return getCachedBuiltAt(key);
}
