import * as SQLite from 'expo-sqlite';
import type { QuestionSyncRow } from '@ibas/shared-types';
import type { ExplanationSection, QuestionDetail, QuestionListItem, QuestionOption } from '@/types/questions';
import type { MarathonExplanationSection, MarathonReviewItem } from '@/types/marathon';
import type { ChapterQuestionBrief } from '@/types/books';
import type { QuestionPracticeStem } from '@/lib/evaluation-api';

const DB_NAME = 'questions.db';

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (db) return db;
  db = SQLite.openDatabaseSync(DB_NAME);
  db.execSync(`
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      question_type_code TEXT NOT NULL,
      body_en TEXT NOT NULL,
      body_bn TEXT,
      difficulty TEXT NOT NULL,
      marks INTEGER NOT NULL,
      time_seconds INTEGER NOT NULL,
      is_published INTEGER NOT NULL,
      is_active INTEGER NOT NULL,
      book_chapter_id TEXT,
      book_topic_id TEXT,
      book_sub_topic_id TEXT,
      regulation_id TEXT,
      book_id TEXT,
      book_name TEXT,
      chapter_number TEXT,
      chapter_name TEXT,
      subject_links TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS question_options (
      question_id TEXT NOT NULL,
      option_id TEXT NOT NULL,
      option_key TEXT NOT NULL,
      option_text_en TEXT NOT NULL,
      option_text_bn TEXT,
      is_correct INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_question_options_question_id ON question_options(question_id);
    CREATE TABLE IF NOT EXISTS question_explanations (
      question_id TEXT PRIMARY KEY,
      explanation_sections TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sync_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      last_synced_at TEXT
    );
  `);
  // Older installs — add subject_links when missing.
  try {
    db.execSync('ALTER TABLE questions ADD COLUMN subject_links TEXT');
  } catch {
    // column already exists
  }
  return db;
}

type QuestionRow = {
  id: string;
  question_type_code: string;
  body_en: string;
  body_bn: string | null;
  difficulty: string;
  marks: number;
  time_seconds: number;
  is_published: number;
  is_active: number;
  book_chapter_id: string | null;
  book_topic_id: string | null;
  book_sub_topic_id: string | null;
  regulation_id: string | null;
  book_id: string | null;
  book_name: string | null;
  chapter_number: string | null;
  chapter_name: string | null;
  subject_links: string | null;
  updated_at: string;
};

type OptionRow = {
  option_id: string;
  option_key: string;
  option_text_en: string;
  option_text_bn: string | null;
  is_correct: number;
};

export function getLastSyncedAt(): string | null {
  const row = getDb().getFirstSync<{ last_synced_at: string | null }>(
    'SELECT last_synced_at FROM sync_state WHERE id = 1',
  );
  return row?.last_synced_at ?? null;
}

export function setLastSyncedAt(value: string): void {
  getDb().runSync(
    `INSERT INTO sync_state (id, last_synced_at) VALUES (1, ?)
     ON CONFLICT(id) DO UPDATE SET last_synced_at = excluded.last_synced_at`,
    [value],
  );
}

export function getCachedQuestionCount(): number {
  const row = getDb().getFirstSync<{ n: number }>('SELECT COUNT(*) as n FROM questions');
  return row?.n ?? 0;
}

/**
 * Applies one page of `/questions/sync` results. Options/explanations are wholesale-replaced
 * per question on every update — matching the server's own replace-on-edit semantics for
 * QuestionOption/QuestionAnswer/QuestionAnswerDetail, so there is nothing to diff row-by-row.
 */
export function applySyncBatch(rows: QuestionSyncRow[], deletedIds: string[]): void {
  const database = getDb();
  database.withTransactionSync(() => {
    for (const row of rows) {
      database.runSync(
        `INSERT INTO questions (
           id, question_type_code, body_en, body_bn, difficulty, marks, time_seconds,
           is_published, is_active, book_chapter_id, book_topic_id, book_sub_topic_id,
           regulation_id, book_id, book_name, chapter_number, chapter_name, subject_links, updated_at
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           question_type_code = excluded.question_type_code,
           body_en = excluded.body_en,
           body_bn = excluded.body_bn,
           difficulty = excluded.difficulty,
           marks = excluded.marks,
           time_seconds = excluded.time_seconds,
           is_published = excluded.is_published,
           is_active = excluded.is_active,
           book_chapter_id = excluded.book_chapter_id,
           book_topic_id = excluded.book_topic_id,
           book_sub_topic_id = excluded.book_sub_topic_id,
           regulation_id = excluded.regulation_id,
           book_id = excluded.book_id,
           book_name = excluded.book_name,
           chapter_number = excluded.chapter_number,
           chapter_name = excluded.chapter_name,
           subject_links = excluded.subject_links,
           updated_at = excluded.updated_at`,
        [
          row.id,
          row.question_type_code,
          row.body_en,
          row.body_bn ?? null,
          row.difficulty,
          row.marks,
          row.time_seconds,
          row.is_published ? 1 : 0,
          row.is_active ? 1 : 0,
          row.book_chapter_id ?? null,
          row.book_topic_id ?? null,
          row.book_sub_topic_id ?? null,
          row.regulation_id ?? null,
          row.book_id ?? null,
          row.book_name ?? null,
          row.chapter_number ?? null,
          row.chapter_name ?? null,
          row.subjects && row.subjects.length > 0 ? JSON.stringify(row.subjects) : null,
          row.updated_at,
        ],
      );

      database.runSync('DELETE FROM question_options WHERE question_id = ?', [row.id]);
      database.runSync('DELETE FROM question_explanations WHERE question_id = ?', [row.id]);

      if (row.question_type_code === 'MCQ') {
        for (const opt of row.options ?? []) {
          database.runSync(
            `INSERT INTO question_options
               (question_id, option_id, option_key, option_text_en, option_text_bn, is_correct)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [row.id, opt.id, opt.option_key, opt.option_text_en, opt.option_text_bn ?? null, opt.is_correct ? 1 : 0],
          );
        }
        if (row.explanation_sections && row.explanation_sections.length > 0) {
          database.runSync(
            'INSERT INTO question_explanations (question_id, explanation_sections) VALUES (?, ?)',
            [row.id, JSON.stringify(row.explanation_sections)],
          );
        }
      }
    }

    for (const id of deletedIds) {
      database.runSync('DELETE FROM questions WHERE id = ?', [id]);
      database.runSync('DELETE FROM question_options WHERE question_id = ?', [id]);
      database.runSync('DELETE FROM question_explanations WHERE question_id = ?', [id]);
    }
  });
}

function parseSubjects(
  raw: string | null,
): Array<{ id: string; name: string; name_bn?: string }> {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as Array<{ id: string; name: string; name_bn?: string }>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toQuestionListItem(row: QuestionRow): QuestionListItem {
  return {
    id: row.id,
    // Not carried by the sync payload; unused by the Question Bank screen today.
    question_type_id: '',
    question_type_code: row.question_type_code,
    body_en: row.body_en,
    body_bn: row.body_bn ?? undefined,
    difficulty: row.difficulty,
    marks: row.marks,
    time_seconds: row.time_seconds,
    is_published: row.is_published === 1,
    book_chapter_id: row.book_chapter_id ?? undefined,
    book_topic_id: row.book_topic_id ?? undefined,
    book_sub_topic_id: row.book_sub_topic_id ?? undefined,
    regulation_id: row.regulation_id ?? undefined,
    book_id: row.book_id ?? undefined,
    book_name: row.book_name ?? undefined,
    chapter_number: row.chapter_number ?? undefined,
    chapter_name: row.chapter_name ?? undefined,
    subjects: parseSubjects(row.subject_links),
    option_count: 0,
    created_at: row.updated_at,
    updated_at: row.updated_at,
  };
}

/**
 * Published, active questions of every type EXCEPT MCQ — what the mobile Question Bank shows.
 * MCQ has its own dedicated Marathon Review screen, so it's excluded here to avoid showing the
 * same questions in both places. Default order is newest publish/modify first; the screen may
 * re-sort when the user turns on book grouping.
 */
export function getCachedQuestionListItems(): QuestionListItem[] {
  const rows = getDb().getAllSync<QuestionRow>(
    `SELECT * FROM questions WHERE is_published = 1 AND is_active = 1 AND question_type_code != 'MCQ'
     ORDER BY updated_at DESC, id DESC`,
  );
  return rows.map(toQuestionListItem);
}

/** Merge server subject tags into already-cached question rows (does not insert missing questions). */
export function mergeCachedQuestionSubjects(
  rows: Array<{ id: string; subjects?: Array<{ id: string; name: string; name_bn?: string }> }>,
): void {
  if (rows.length === 0) return;
  const database = getDb();
  database.withTransactionSync(() => {
    for (const row of rows) {
      const payload =
        row.subjects && row.subjects.length > 0 ? JSON.stringify(row.subjects) : null;
      database.runSync('UPDATE questions SET subject_links = ? WHERE id = ?', [payload, row.id]);
    }
  });
}

/**
 * Published MCQs linked to a book chapter, for Marathon Review. Ordering approximates the
 * server's book/chapter grouping (book name, then chapter number, then question text) — good
 * enough for a local cache since the screen only uses it to group and display, not to assign
 * any persisted rank.
 */
export function getCachedMarathonItems(): MarathonReviewItem[] {
  const rows = getDb().getAllSync<QuestionRow>(
    `SELECT * FROM questions
     WHERE question_type_code = 'MCQ' AND is_published = 1 AND is_active = 1
       AND book_id IS NOT NULL AND book_name IS NOT NULL
     ORDER BY book_name COLLATE NOCASE ASC, chapter_number COLLATE NOCASE ASC, body_en COLLATE NOCASE ASC, id ASC`,
  );

  const ids = rows.map((r) => r.id);
  const explanationByQuestion = new Map<string, MarathonExplanationSection[]>();
  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const explRows = getDb().getAllSync<{ question_id: string; explanation_sections: string }>(
      `SELECT question_id, explanation_sections FROM question_explanations WHERE question_id IN (${placeholders})`,
      ids,
    );
    for (const e of explRows) {
      try {
        explanationByQuestion.set(e.question_id, JSON.parse(e.explanation_sections));
      } catch {
        // Corrupt row from a previous app version — skip rather than crash the screen.
      }
    }
  }

  return rows.map((row, index) => ({
    id: row.id,
    number: index + 1,
    body_en: row.body_en,
    body_bn: row.body_bn ?? undefined,
    book_id: row.book_id!,
    book_name: row.book_name!,
    chapter_id: row.book_chapter_id ?? `${row.book_id}:${row.chapter_name ?? ''}`,
    chapter_number: row.chapter_number ?? '',
    chapter_name: row.chapter_name ?? '',
    explanation_sections: explanationByQuestion.get(row.id),
  }));
}

export interface CachedQuestionBase {
  id: string;
  question_type_code: string;
  body_en: string;
  body_bn?: string;
  difficulty: string;
  marks: number;
  time_seconds: number;
  book_id?: string;
  book_name?: string;
  chapter_number?: string;
  chapter_name?: string;
}

/** Base fields for any cached, still-active question — regardless of published state, matching
 * the server's own detail-view rule (unpublished-but-active questions can still be opened by id). */
export function getCachedQuestionBase(id: string): CachedQuestionBase | null {
  const row = getDb().getFirstSync<QuestionRow>(
    'SELECT * FROM questions WHERE id = ? AND is_active = 1',
    [id],
  );
  if (!row) return null;
  return {
    id: row.id,
    question_type_code: row.question_type_code,
    body_en: row.body_en,
    body_bn: row.body_bn ?? undefined,
    difficulty: row.difficulty,
    marks: row.marks,
    time_seconds: row.time_seconds,
    book_id: row.book_id ?? undefined,
    book_name: row.book_name ?? undefined,
    chapter_number: row.chapter_number ?? undefined,
    chapter_name: row.chapter_name ?? undefined,
  };
}

export interface CachedQuestionAnswer {
  options: QuestionOption[];
  explanation_sections?: ExplanationSection[];
}

/** MCQ-only local answer lookup — everything else keeps calling the API for its answer. */
export function getCachedQuestionAnswer(id: string): CachedQuestionAnswer | null {
  const database = getDb();
  const question = database.getFirstSync<{ question_type_code: string }>(
    'SELECT question_type_code FROM questions WHERE id = ? AND is_active = 1',
    [id],
  );
  if (!question || question.question_type_code !== 'MCQ') return null;

  const optionRows = database.getAllSync<OptionRow>(
    'SELECT option_id, option_key, option_text_en, option_text_bn, is_correct FROM question_options WHERE question_id = ? ORDER BY option_key ASC',
    [id],
  );
  if (optionRows.length === 0) return null;

  const explRow = database.getFirstSync<{ explanation_sections: string }>(
    'SELECT explanation_sections FROM question_explanations WHERE question_id = ?',
    [id],
  );
  let explanation_sections: ExplanationSection[] | undefined;
  if (explRow) {
    try {
      explanation_sections = JSON.parse(explRow.explanation_sections);
    } catch {
      explanation_sections = undefined;
    }
  }

  return {
    options: optionRows.map((o) => ({
      id: o.option_id,
      option_key: o.option_key,
      option_text_en: o.option_text_en,
      option_text_bn: o.option_text_bn ?? undefined,
      is_correct: o.is_correct === 1,
    })),
    explanation_sections,
  };
}

/**
 * Full QuestionDetail for the local-first detail views (question-bank detail screen, chapter
 * tagged-questions panel) — MCQ only, same restriction as getCachedQuestionAnswer. Callers fall
 * back to fetchQuestionDetail(id) over the network when this returns null.
 */
export function getCachedMcqDetail(id: string): QuestionDetail | null {
  const base = getCachedQuestionBase(id);
  if (!base || base.question_type_code !== 'MCQ') return null;
  const answer = getCachedQuestionAnswer(id);
  if (!answer) return null;
  return {
    id: base.id,
    question_type_id: '',
    question_type_code: base.question_type_code,
    has_options: true,
    body_en: base.body_en,
    body_bn: base.body_bn,
    difficulty: base.difficulty,
    marks: base.marks,
    time_seconds: base.time_seconds,
    is_published: true,
    book_id: base.book_id,
    book_name: base.book_name,
    chapter_number: base.chapter_number,
    chapter_name: base.chapter_name,
    options: answer.options,
    explanation_sections: answer.explanation_sections,
  };
}

/**
 * MCQ practice stem built from the local cache — options carry no `is_correct` signal, matching
 * the server's own practice endpoint (evaluationService.getQuestionPracticeStem), which hides the
 * answer until the user submits.
 */
export function getCachedPracticeStem(id: string): QuestionPracticeStem | null {
  const base = getCachedQuestionBase(id);
  if (!base || base.question_type_code !== 'MCQ') return null;
  const answer = getCachedQuestionAnswer(id);
  if (!answer || answer.options.length === 0) return null;
  return {
    id: base.id,
    body_en: base.body_en,
    body_bn: base.body_bn,
    question_type_code: base.question_type_code,
    has_options: true,
    options: answer.options.map((o) => ({ ...o, is_correct: false })),
  };
}

/**
 * Published questions tagged to a book chapter, for the "Books & Tools" chapter questions panel.
 * Matches on the question's own (legacy, always-set) `book_chapter_id` field — the primary link
 * point regardless of whether the admin tagged it at chapter/topic/sub-topic level. Questions
 * additionally tagged to *other* chapters via a secondary QuestionBookLink are not reflected here
 * (the server's `/books/chapters/:id/questions` also walks those extra links); that's a rare
 * multi-tagging case and out of scope for the local cache.
 */
export function getCachedChapterQuestions(chapterId: string): ChapterQuestionBrief[] {
  const rows = getDb().getAllSync<QuestionRow>(
    `SELECT * FROM questions
     WHERE book_chapter_id = ? AND is_published = 1 AND is_active = 1
     ORDER BY question_type_code ASC, updated_at DESC`,
    [chapterId],
  );
  return rows.map((row) => ({
    id: row.id,
    question_type_code: row.question_type_code,
    body_en: row.body_en,
    body_bn: row.body_bn ?? '',
    marks: row.marks,
    difficulty: row.difficulty,
  }));
}

/**
 * Published questions tagged to any chapter of a book, for the single book-level "Questions"
 * button on the Books & Tools detail screen — same shape/ordering as getCachedChapterQuestions,
 * just matched on book_id instead of one chapter.
 */
export function getCachedBookQuestions(bookId: string): ChapterQuestionBrief[] {
  const rows = getDb().getAllSync<QuestionRow>(
    `SELECT * FROM questions
     WHERE book_id = ? AND is_published = 1 AND is_active = 1
     ORDER BY question_type_code ASC, updated_at DESC`,
    [bookId],
  );
  return rows.map((row) => ({
    id: row.id,
    question_type_code: row.question_type_code,
    body_en: row.body_en,
    body_bn: row.body_bn ?? '',
    marks: row.marks,
    difficulty: row.difficulty,
  }));
}
