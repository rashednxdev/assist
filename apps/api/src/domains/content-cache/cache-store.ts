import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../shared/logger.js';

export const CONTENT_CACHE_KEYS = [
  'learning.stats',
  'books.list',
  'exams.names',
  'papers.published',
  'questions.published',
] as const;

export type ContentCacheKey = (typeof CONTENT_CACHE_KEYS)[number];

export interface LearningStatsCache {
  books: number;
  questions: number;
  exams: number;
  papers: number;
  built_at: string;
}

export interface CacheMeta {
  key: ContentCacheKey;
  built_at: string | null;
  item_count: number | null;
  bytes: number | null;
  in_memory: boolean;
  on_disk: boolean;
}

interface CacheEnvelope<T> {
  built_at: string;
  data: T;
}

const memory = new Map<ContentCacheKey, CacheEnvelope<unknown>>();

function cacheDir(): string {
  return env.CONTENT_CACHE_DIR || path.join(process.cwd(), 'data', 'cache');
}

function filePath(key: ContentCacheKey): string {
  const safe = key.replace(/\./g, '-');
  return path.join(cacheDir(), `${safe}.json`);
}

export function getCached<T>(key: ContentCacheKey): T | null {
  const hit = memory.get(key);
  return hit ? (hit.data as T) : null;
}

export function getCachedBuiltAt(key: ContentCacheKey): string | null {
  return memory.get(key)?.built_at ?? null;
}

export async function setCached<T>(key: ContentCacheKey, data: T): Promise<void> {
  const envelope: CacheEnvelope<T> = {
    built_at: new Date().toISOString(),
    data,
  };
  memory.set(key, envelope as CacheEnvelope<unknown>);

  const dir = cacheDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath(key), JSON.stringify(envelope), 'utf8');
}

export async function loadCacheFromDisk(): Promise<void> {
  for (const key of CONTENT_CACHE_KEYS) {
    try {
      const raw = await fs.readFile(filePath(key), 'utf8');
      const parsed = JSON.parse(raw) as CacheEnvelope<unknown>;
      if (parsed && typeof parsed === 'object' && 'data' in parsed) {
        memory.set(key, {
          built_at: typeof parsed.built_at === 'string' ? parsed.built_at : new Date().toISOString(),
          data: parsed.data,
        });
      }
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
      if (code !== 'ENOENT') {
        logger.warn({ err, key }, 'Failed to load content cache file');
      }
    }
  }
  logger.info({ keys: [...memory.keys()] }, 'Content cache loaded from disk');
}

export async function getCacheStatus(): Promise<CacheMeta[]> {
  const rows: CacheMeta[] = [];
  for (const key of CONTENT_CACHE_KEYS) {
    const mem = memory.get(key);
    let onDisk = false;
    let bytes: number | null = null;
    try {
      const st = await fs.stat(filePath(key));
      onDisk = st.isFile();
      bytes = st.size;
    } catch {
      onDisk = false;
    }

    let itemCount: number | null = null;
    if (mem?.data !== undefined) {
      if (Array.isArray(mem.data)) itemCount = mem.data.length;
      else if (mem.data && typeof mem.data === 'object' && 'questions' in (mem.data as object)) {
        itemCount = 4;
      }
    }

    rows.push({
      key,
      built_at: mem?.built_at ?? null,
      item_count: itemCount,
      bytes,
      in_memory: Boolean(mem),
      on_disk: onDisk,
    });
  }
  return rows;
}

export function clearMemoryCache(): void {
  memory.clear();
}
