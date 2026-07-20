'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileUp, Plus, Search, Trash2, Undo2, Upload, X } from 'lucide-react';
import { QUESTION_LINK_LEVELS, type QuestionLinkLevel } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { chapterHeading } from '@/lib/book-display';
import { buildNewQuestionHref } from '@/lib/question-book-context';
import {
  parseMcqCsv,
  parseDescriptiveCsv,
  parseDifferencesCsv,
  type ParsedMcqCsvRow,
  type ParsedDescriptiveCsvRow,
  type ParsedDifferencesCsvRow,
} from '@/lib/mcq-csv';
import type { ReaderChapter } from '@/components/books/book-reader-context';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface ManageQuestionRow {
  link_id: string;
  question_id: string;
  link_level: QuestionLinkLevel;
  link_label: string;
  book_topic_id?: string;
  book_sub_topic_id?: string;
  regulation_id?: string;
  body_en: string;
  marks: number;
  question_type_code: string;
  is_published: boolean;
}

interface SearchQuestion {
  id: string;
  body_en: string;
  question_type_code: string;
  marks: number;
  is_published: boolean;
}

interface SubTopicItem {
  id: string;
  name: string;
  rule_number?: string;
}

interface RegulationItem {
  id: string;
  regulation_no: string;
  title: string;
}

type FilterMode = 'all' | 'draft' | 'published';
type CsvImportKind = 'mcq' | 'descriptive' | 'differences';

function plainText(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function linkLevelLabel(level: QuestionLinkLevel) {
  if (level === 'chapter') return 'Chapter';
  if (level === 'rule') return 'Rule';
  return 'Sub-rule';
}

export function ChapterQuestionsManageModal({
  open,
  onOpenChange,
  bookId,
  chapter,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bookId: string;
  chapter: ReaderChapter;
}) {
  const [rows, setRows] = useState<ManageQuestionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [publishBusyId, setPublishBusyId] = useState<string | null>(null);
  const [publishAllBusy, setPublishAllBusy] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<SearchQuestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const [linkLevel, setLinkLevel] = useState<QuestionLinkLevel | ''>('chapter');
  const [topicId, setTopicId] = useState('');
  const [subTopicId, setSubTopicId] = useState('');
  const [regulationId, setRegulationId] = useState('');
  const [subTopics, setSubTopics] = useState<SubTopicItem[]>([]);
  const [regulations, setRegulations] = useState<RegulationItem[]>([]);
  const [linkBusy, setLinkBusy] = useState(false);

  const [csvKind, setCsvKind] = useState<CsvImportKind>('mcq');
  const [csvMcqRows, setCsvMcqRows] = useState<ParsedMcqCsvRow[]>([]);
  const [csvDescRows, setCsvDescRows] = useState<ParsedDescriptiveCsvRow[]>([]);
  const [csvDiffRows, setCsvDiffRows] = useState<ParsedDifferencesCsvRow[]>([]);
  const [csvExcluded, setCsvExcluded] = useState<Set<number>>(() => new Set());
  const [csvSelected, setCsvSelected] = useState<Set<number>>(() => new Set());
  const [csvParseNotes, setCsvParseNotes] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvPublish, setCsvPublish] = useState(false);
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvDescTypeId, setCsvDescTypeId] = useState('');
  const [csvDiffTypeId, setCsvDiffTypeId] = useState('');
  const [questionTypes, setQuestionTypes] = useState<
    Array<{ id: string; name: string; code: string; has_options: boolean }>
  >([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ data: ManageQuestionRow[] }>(
        `/books/chapters/${chapter.id}/questions/manage`,
      );
      setRows(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load chapter questions');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [chapter.id]);

  useEffect(() => {
    if (!open) return;
    void loadRows();
    setSearchQ('');
    setSearchResults([]);
    setSelectedQuestionId(null);
    setLinkLevel('chapter');
    setTopicId('');
    setSubTopicId('');
    setRegulationId('');
    setFilter('all');
    setMessage('');
    setError('');
    setCsvKind('mcq');
    setCsvMcqRows([]);
    setCsvDescRows([]);
    setCsvDiffRows([]);
    setCsvExcluded(new Set());
    setCsvSelected(new Set());
    setCsvParseNotes([]);
    setCsvFileName('');
    setCsvPublish(false);
    setCsvImporting(false);
    setCsvDescTypeId('');
    setCsvDiffTypeId('');
    apiFetch<{
      data: Array<{ id: string; name: string; code: string; has_options: boolean }>;
    }>('/questions/types')
      .then((res) => {
        setQuestionTypes(res.data);
        const preferred =
          res.data.find((t) => !t.has_options && /^descriptive$/i.test(t.code)) ||
          res.data.find((t) => !t.has_options && /^descriptive$/i.test(t.name)) ||
          res.data.find((t) => !t.has_options && /descriptive/i.test(t.name)) ||
          res.data.find(
            (t) => !t.has_options && !/^differences?$/i.test(t.code) && t.code !== 'DF',
          );
        if (preferred) setCsvDescTypeId(preferred.id);
        const preferredDiff =
          res.data.find((t) => !t.has_options && /^differences?$/i.test(t.code)) ||
          res.data.find((t) => !t.has_options && /^differences?$/i.test(t.name)) ||
          res.data.find((t) => !t.has_options && /differences/i.test(t.name));
        if (preferredDiff) setCsvDiffTypeId(preferredDiff.id);
      })
      .catch(() => setQuestionTypes([]));
  }, [open, loadRows]);

  useEffect(() => {
    if (!open) return;
    const onFocus = () => {
      void loadRows();
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [open, loadRows]);

  useEffect(() => {
    if (!open || !topicId) {
      setSubTopics([]);
      setRegulations([]);
      return;
    }
    apiFetch<{ data: { sub_topics: SubTopicItem[]; regulations: RegulationItem[] } }>(
      `/books/topics/${topicId}`,
    )
      .then((r) => {
        setSubTopics(r.data.sub_topics ?? []);
        setRegulations(r.data.regulations ?? []);
      })
      .catch(() => {
        setSubTopics([]);
        setRegulations([]);
      });
  }, [open, topicId]);

  useEffect(() => {
    if (!open) return;
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      setSearching(true);
      apiFetch<{ data: SearchQuestion[] }>(`/questions?q=${encodeURIComponent(q)}&limit=20`)
        .then((r) => setSearchResults(r.data))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [open, searchQ]);

  const stats = useMemo(() => {
    const unique = new Map<string, ManageQuestionRow>();
    for (const row of rows) {
      if (!unique.has(row.question_id)) unique.set(row.question_id, row);
    }
    const list = [...unique.values()];
    const published = list.filter((r) => r.is_published).length;
    return { total: list.length, published, drafts: list.length - published };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === 'draft') return rows.filter((r) => !r.is_published);
    if (filter === 'published') return rows.filter((r) => r.is_published);
    return rows;
  }, [rows, filter]);

  async function linkSelectedQuestion() {
    if (!selectedQuestionId || !linkLevel) return;
    if (linkLevel === 'rule' && !topicId) {
      setError('Select a rule for this link');
      return;
    }
    if (linkLevel === 'sub_rule' && (!topicId || !subTopicId)) {
      setError('Select a rule and sub-rule for this link');
      return;
    }

    setLinkBusy(true);
    setError('');
    setMessage('');
    try {
      await apiFetch(`/questions/${selectedQuestionId}/book-links`, {
        method: 'POST',
        body: JSON.stringify({
          link_level: linkLevel,
          book_chapter_id: chapter.id,
          book_topic_id: topicId || undefined,
          book_sub_topic_id: subTopicId || undefined,
          regulation_id: regulationId || undefined,
        }),
      });
      setMessage('Question linked to this chapter');
      setSelectedQuestionId(null);
      setSearchQ('');
      setSearchResults([]);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link question');
    } finally {
      setLinkBusy(false);
    }
  }

  async function unlinkRow(row: ManageQuestionRow) {
    if (!confirm('Remove this book link from the question?')) return;
    setLinkBusy(true);
    setError('');
    try {
      await apiFetch(`/questions/${row.question_id}/book-links/${row.link_id}`, { method: 'DELETE' });
      setMessage('Link removed');
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove link');
    } finally {
      setLinkBusy(false);
    }
  }

  async function togglePublishRow(row: ManageQuestionRow) {
    setPublishBusyId(row.question_id);
    setError('');
    try {
      const path = row.is_published
        ? `/questions/${row.question_id}/unpublish`
        : `/questions/${row.question_id}/publish`;
      await apiFetch(path, { method: 'POST' });
      setMessage(row.is_published ? 'Question unpublished' : 'Question published for learners');
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publish action failed');
    } finally {
      setPublishBusyId(null);
    }
  }

  async function publishAllDrafts() {
    const draftIds = [...new Set(rows.filter((r) => !r.is_published).map((r) => r.question_id))];
    if (draftIds.length === 0) return;
    setPublishAllBusy(true);
    setError('');
    try {
      await Promise.all(
        draftIds.map((id) => apiFetch(`/questions/${id}/publish`, { method: 'POST' })),
      );
      setMessage(`Published ${draftIds.length} draft question${draftIds.length !== 1 ? 's' : ''}`);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish all drafts');
    } finally {
      setPublishAllBusy(false);
    }
  }

  function clearCsvPreview() {
    setCsvMcqRows([]);
    setCsvDescRows([]);
    setCsvDiffRows([]);
    setCsvExcluded(new Set());
    setCsvSelected(new Set());
    setCsvParseNotes([]);
    setCsvFileName('');
    if (csvInputRef.current) csvInputRef.current.value = '';
  }

  function toggleCsvExclude(index: number) {
    setCsvExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleCsvSelect(index: number) {
    setCsvSelected((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  function toggleCsvSelectAll() {
    if (csvSelected.size === csvRowCount) {
      setCsvSelected(new Set());
      return;
    }
    setCsvSelected(new Set(Array.from({ length: csvRowCount }, (_, i) => i)));
  }

  function batchExcludeSelected() {
    if (csvSelected.size === 0) return;
    setCsvExcluded((prev) => {
      const next = new Set(prev);
      for (const i of csvSelected) next.add(i);
      return next;
    });
    setCsvSelected(new Set());
  }

  function batchIncludeSelected() {
    if (csvSelected.size === 0) return;
    setCsvExcluded((prev) => {
      const next = new Set(prev);
      for (const i of csvSelected) next.delete(i);
      return next;
    });
    setCsvSelected(new Set());
  }

  function excludeAllCsvRows() {
    setCsvExcluded(new Set(Array.from({ length: csvRowCount }, (_, i) => i)));
    setCsvSelected(new Set());
  }

  const csvRowCount =
    csvKind === 'mcq' ? csvMcqRows.length : csvKind === 'descriptive' ? csvDescRows.length : csvDiffRows.length;
  const csvIncludedMcq = useMemo(
    () => csvMcqRows.filter((_, i) => !csvExcluded.has(i)),
    [csvMcqRows, csvExcluded],
  );
  const csvIncludedDesc = useMemo(
    () => csvDescRows.filter((_, i) => !csvExcluded.has(i)),
    [csvDescRows, csvExcluded],
  );
  const csvIncludedDiff = useMemo(
    () => csvDiffRows.filter((_, i) => !csvExcluded.has(i)),
    [csvDiffRows, csvExcluded],
  );
  const csvIncludedCount =
    csvKind === 'mcq'
      ? csvIncludedMcq.length
      : csvKind === 'descriptive'
        ? csvIncludedDesc.length
        : csvIncludedDiff.length;
  const csvAllSelected = csvRowCount > 0 && csvSelected.size === csvRowCount;

  function changeCsvKind(kind: CsvImportKind) {
    if (kind === csvKind) return;
    setCsvKind(kind);
    clearCsvPreview();
  }

  async function onCsvFileSelected(file: File | null) {
    setError('');
    setMessage('');
    if (!file) {
      clearCsvPreview();
      return;
    }
    try {
      const text = await file.text();
      setCsvFileName(file.name);
      setCsvExcluded(new Set());
      setCsvSelected(new Set());
      if (csvKind === 'mcq') {
        const parsed = parseMcqCsv(text);
        setCsvParseNotes(parsed.errors);
        setCsvMcqRows(parsed.rows);
        setCsvDescRows([]);
        setCsvDiffRows([]);
        if (parsed.rows.length === 0 && parsed.errors.length) {
          setError(parsed.errors[0]!);
        }
      } else if (csvKind === 'descriptive') {
        const parsed = parseDescriptiveCsv(text);
        setCsvParseNotes(parsed.errors);
        setCsvDescRows(parsed.rows);
        setCsvMcqRows([]);
        setCsvDiffRows([]);
        if (parsed.rows.length === 0 && parsed.errors.length) {
          setError(parsed.errors[0]!);
        }
      } else {
        const parsed = parseDifferencesCsv(text);
        setCsvParseNotes(parsed.errors);
        setCsvDiffRows(parsed.rows);
        setCsvMcqRows([]);
        setCsvDescRows([]);
        if (parsed.rows.length === 0 && parsed.errors.length) {
          setError(parsed.errors[0]!);
        }
      }
    } catch (err) {
      clearCsvPreview();
      setError(err instanceof Error ? err.message : 'Failed to read CSV file');
    }
  }

  const descriptiveTypes = useMemo(
    () =>
      questionTypes.filter(
        (t) => !t.has_options && !/^differences?$/i.test(t.code) && t.code !== 'DF',
      ),
    [questionTypes],
  );

  const differencesTypes = useMemo(
    () =>
      questionTypes.filter(
        (t) => !t.has_options && (/^differences?$/i.test(t.code) || /differences/i.test(t.name)),
      ),
    [questionTypes],
  );

  async function importCsvRows() {
    if (csvIncludedCount === 0) return;
    if (csvKind === 'descriptive' && !csvDescTypeId) {
      setError('Select the existing Descriptive question type before importing.');
      return;
    }
    if (csvKind === 'differences' && !csvDiffTypeId) {
      setError('Select the existing DIFFERENCES question type before importing.');
      return;
    }
    setCsvImporting(true);
    setError('');
    setMessage('');
    try {
      const path =
        csvKind === 'mcq'
          ? '/questions/batch-import'
          : csvKind === 'descriptive'
            ? '/questions/batch-import-descriptive'
            : '/questions/batch-import-differences';
      const rows = csvKind === 'mcq' ? csvIncludedMcq : csvKind === 'descriptive' ? csvIncludedDesc : csvIncludedDiff;
      const res = await apiFetch<{
        data: {
          created_count: number;
          failed_count: number;
          failed: Array<{ row: number; error: string }>;
        };
      }>(path, {
        method: 'POST',
        body: JSON.stringify({
          book_chapter_id: chapter.id,
          publish: csvPublish,
          rows,
          ...(csvKind === 'descriptive' ? { question_type_id: csvDescTypeId } : {}),
          ...(csvKind === 'differences' ? { question_type_id: csvDiffTypeId } : {}),
        }),
      });
      const { created_count, failed_count, failed } = res.data;
      const label = csvKind === 'mcq' ? 'MCQ' : csvKind === 'descriptive' ? 'descriptive question' : 'DIFFERENCES question';
      const parts = [
        `Imported ${created_count} ${label}${created_count !== 1 ? 's' : ''} for this chapter`,
      ];
      if (csvPublish) parts.push('(published)');
      if (csvExcluded.size > 0) {
        parts.push(`${csvExcluded.size} excluded before import`);
      }
      if (failed_count > 0) {
        parts.push(`${failed_count} failed`);
        setError(
          failed
            .slice(0, 5)
            .map((f) => `Row ${f.row}: ${f.error}`)
            .join(' · ') + (failed.length > 5 ? '…' : ''),
        );
      }
      setMessage(parts.join(' — '));
      if (created_count > 0) {
        clearCsvPreview();
        await loadRows();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setCsvImporting(false);
    }
  }

  const newQuestionHref = buildNewQuestionHref({
    bookId,
    chapterId: chapter.id,
    linkLevel: 'chapter',
    topicId: '',
    subTopicId: '',
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center p-0 sm:p-2 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        className="relative z-10 flex h-[100dvh] max-h-[100dvh] w-full max-w-[100vw] flex-col overflow-hidden rounded-none border border-border bg-background shadow-xl sm:h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-1rem)] sm:max-w-[calc(100vw-1rem)] sm:rounded-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">Chapter questions</h2>
            <p className="mt-0.5 text-sm text-muted">{chapterHeading(chapter)}</p>
            {!loading && stats.total > 0 && (
              <p className="mt-1 text-xs text-muted">
                {stats.published} published · {stats.drafts} draft
              </p>
            )}
          </div>
          <Button type="button" size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {message && <Alert variant="success">{message}</Alert>}
          {error && <Alert variant="error">{error}</Alert>}

          <section className="space-y-3 rounded-lg border border-dashed border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1 space-y-2">
                <h3 className="text-sm font-semibold">Batch question import (CSV)</h3>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { id: 'mcq', label: 'MCQ' },
                      { id: 'descriptive', label: 'Descriptive' },
                      { id: 'differences', label: 'DIFFERENCES' },
                    ] as const
                  ).map((opt) => (
                    <Button
                      key={opt.id}
                      type="button"
                      size="sm"
                      variant={csvKind === opt.id ? 'default' : 'outline'}
                      className="h-8"
                      disabled={csvImporting}
                      onClick={() => changeCsvKind(opt.id)}
                    >
                      {opt.label}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted">
                  {csvKind === 'mcq'
                    ? 'Columns: question, option_a, option_b, option_c, option_d, correct_option, explanation. Extra columns are ignored.'
                    : csvKind === 'descriptive'
                      ? 'Columns: question, title, description, note (or note_reference). Empty title/description/note fields are ignored. Uses your existing Descriptive type.'
                      : 'One row per comparison-table feature row, grouped by question_no. Columns: question_no, question, feature_header, column_1, column_2 (…column_6), feature, value_1, value_2 (…value_6). Fill question/feature_header/column_N only on each question’s first row.'}
                </p>
                {csvKind === 'descriptive' ? (
                  <div className="space-y-1">
                    <Label htmlFor="csv-desc-type">Question type</Label>
                    <select
                      id="csv-desc-type"
                      className="ibas-select"
                      value={csvDescTypeId}
                      disabled={csvImporting || descriptiveTypes.length === 0}
                      onChange={(e) => setCsvDescTypeId(e.target.value)}
                    >
                      {descriptiveTypes.length === 0 ? (
                        <option value="">No descriptive type found</option>
                      ) : (
                        descriptiveTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.code})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                ) : null}
                {csvKind === 'differences' ? (
                  <div className="space-y-1">
                    <Label htmlFor="csv-diff-type">Question type</Label>
                    <select
                      id="csv-diff-type"
                      className="ibas-select"
                      value={csvDiffTypeId}
                      disabled={csvImporting || differencesTypes.length === 0}
                      onChange={(e) => setCsvDiffTypeId(e.target.value)}
                    >
                      {differencesTypes.length === 0 ? (
                        <option value="">No DIFFERENCES type found</option>
                      ) : (
                        differencesTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.code})
                          </option>
                        ))
                      )}
                    </select>
                  </div>
                ) : null}
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={csvImporting}
                onClick={() => csvInputRef.current?.click()}
              >
                <FileUp className="h-4 w-4" />
                Choose CSV
              </Button>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => void onCsvFileSelected(e.target.files?.[0] ?? null)}
              />
            </div>

            {csvFileName && (
              <p className="text-xs text-muted">
                File: <span className="font-medium text-foreground">{csvFileName}</span>
                {csvRowCount > 0
                  ? ` · ${csvIncludedCount} of ${csvRowCount} question(s) ready`
                  : ''}
                {csvExcluded.size > 0 ? ` · ${csvExcluded.size} excluded` : ''}
              </p>
            )}

            {csvParseNotes.length > 0 && (
              <ul className="list-inside list-disc text-xs text-muted">
                {csvParseNotes.slice(0, 8).map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            )}

            {csvRowCount > 0 && (
              <>
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={csvAllSelected}
                      disabled={csvImporting}
                      onChange={toggleCsvSelectAll}
                    />
                    Select all ({csvSelected.size}/{csvRowCount})
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 text-red-600 hover:bg-red-50 hover:text-red-700"
                    disabled={csvImporting || csvSelected.size === 0}
                    onClick={batchExcludeSelected}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Exclude selected ({csvSelected.size})
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8"
                    disabled={csvImporting || csvSelected.size === 0}
                    onClick={batchIncludeSelected}
                  >
                    <Undo2 className="h-3.5 w-3.5" />
                    Include selected
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-8"
                    disabled={csvImporting || csvExcluded.size === csvRowCount}
                    onClick={excludeAllCsvRows}
                  >
                    Exclude all
                  </Button>
                </div>

                <div className="max-h-[min(50vh,28rem)] overflow-auto rounded-md border border-border">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-muted/60">
                      <tr>
                        <th className="w-8 px-2 py-1.5">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border"
                            checked={csvAllSelected}
                            disabled={csvImporting}
                            onChange={toggleCsvSelectAll}
                            aria-label="Select all rows"
                          />
                        </th>
                        <th className="px-2 py-1.5 font-medium">#</th>
                        <th className="px-2 py-1.5 font-medium">Question</th>
                        {csvKind === 'mcq' ? (
                          <th className="px-2 py-1.5 font-medium">Ans</th>
                        ) : csvKind === 'descriptive' ? (
                          <>
                            <th className="px-2 py-1.5 font-medium">Title</th>
                            <th className="px-2 py-1.5 font-medium">Description</th>
                            <th className="px-2 py-1.5 font-medium">Note</th>
                          </>
                        ) : (
                          <>
                            <th className="px-2 py-1.5 font-medium">Columns</th>
                            <th className="px-2 py-1.5 font-medium">Rows</th>
                          </>
                        )}
                        <th className="px-2 py-1.5 text-right font-medium">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvKind === 'mcq' ? (
                        csvMcqRows.map((r, i) => {
                            const excluded = csvExcluded.has(i);
                            const selected = csvSelected.has(i);
                            return (
                              <tr
                                key={`mcq-${i}-${r.question.slice(0, 24)}`}
                                className={`border-t border-border ${
                                  excluded
                                    ? 'bg-muted/30 opacity-55'
                                    : selected
                                      ? 'bg-primary-muted/40'
                                      : ''
                                }`}
                              >
                                <td className="px-2 py-1 align-top">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-border"
                                    checked={selected}
                                    disabled={csvImporting}
                                    onChange={() => toggleCsvSelect(i)}
                                    aria-label={`Select row ${i + 1}`}
                                  />
                                </td>
                                <td className="px-2 py-1 align-top text-muted">{i + 1}</td>
                                <td
                                  className={`px-2 py-1.5 align-top whitespace-pre-wrap break-words ${excluded ? 'line-through text-muted' : ''}`}
                                >
                                  {plainText(r.question)}
                                </td>
                                <td className="px-2 py-1 align-top uppercase">{r.correct_option}</td>
                                <td className="px-2 py-1 align-top text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    disabled={csvImporting}
                                    onClick={() => toggleCsvExclude(i)}
                                    title={excluded ? 'Include again' : 'Exclude from import'}
                                  >
                                    {excluded ? (
                                      <>
                                        <Undo2 className="h-3.5 w-3.5" />
                                        Include
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Exclude
                                      </>
                                    )}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                      ) : csvKind === 'descriptive' ? (
                        csvDescRows.map((r, i) => {
                            const excluded = csvExcluded.has(i);
                            const selected = csvSelected.has(i);
                            return (
                              <tr
                                key={`desc-${i}-${r.question.slice(0, 24)}`}
                                className={`border-t border-border ${
                                  excluded
                                    ? 'bg-muted/30 opacity-55'
                                    : selected
                                      ? 'bg-primary-muted/40'
                                      : ''
                                }`}
                              >
                                <td className="px-2 py-1 align-top">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 rounded border-border"
                                    checked={selected}
                                    disabled={csvImporting}
                                    onChange={() => toggleCsvSelect(i)}
                                    aria-label={`Select row ${i + 1}`}
                                  />
                                </td>
                                <td className="px-2 py-1 align-top text-muted">{i + 1}</td>
                                <td
                                  className={`px-2 py-1.5 align-top whitespace-pre-wrap break-words ${excluded ? 'line-through text-muted' : ''}`}
                                >
                                  {plainText(r.question)}
                                </td>
                                <td
                                  className={`px-2 py-1.5 align-top whitespace-pre-wrap break-words ${excluded ? 'line-through text-muted' : ''}`}
                                >
                                  {r.title || '—'}
                                </td>
                                <td
                                  className={`px-2 py-1.5 align-top whitespace-pre-wrap break-words ${excluded ? 'line-through text-muted' : ''}`}
                                >
                                  {r.description || '—'}
                                </td>
                                <td
                                  className={`px-2 py-1.5 align-top whitespace-pre-wrap break-words ${excluded ? 'line-through text-muted' : ''}`}
                                >
                                  {r.note || '—'}
                                </td>
                                <td className="px-2 py-1 align-top text-right">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    disabled={csvImporting}
                                    onClick={() => toggleCsvExclude(i)}
                                    title={excluded ? 'Include again' : 'Exclude from import'}
                                  >
                                    {excluded ? (
                                      <>
                                        <Undo2 className="h-3.5 w-3.5" />
                                        Include
                                      </>
                                    ) : (
                                      <>
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Exclude
                                      </>
                                    )}
                                  </Button>
                                </td>
                              </tr>
                            );
                          })
                      ) : (
                        csvDiffRows.map((r, i) => {
                          const excluded = csvExcluded.has(i);
                          const selected = csvSelected.has(i);
                          const table = r.model_answer_comparison;
                          return (
                            <tr
                              key={`diff-${i}-${r.question.slice(0, 24)}`}
                              className={`border-t border-border ${
                                excluded
                                  ? 'bg-muted/30 opacity-55'
                                  : selected
                                    ? 'bg-primary-muted/40'
                                    : ''
                              }`}
                            >
                              <td className="px-2 py-1 align-top">
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 rounded border-border"
                                  checked={selected}
                                  disabled={csvImporting}
                                  onChange={() => toggleCsvSelect(i)}
                                  aria-label={`Select row ${i + 1}`}
                                />
                              </td>
                              <td className="px-2 py-1 align-top text-muted">{i + 1}</td>
                              <td
                                className={`px-2 py-1.5 align-top whitespace-pre-wrap break-words ${excluded ? 'line-through text-muted' : ''}`}
                              >
                                {plainText(r.question)}
                              </td>
                              <td
                                className={`px-2 py-1.5 align-top whitespace-pre-wrap break-words ${excluded ? 'line-through text-muted' : ''}`}
                              >
                                {table.columns.join(' vs ')}
                              </td>
                              <td className={`px-2 py-1 align-top ${excluded ? 'text-muted' : ''}`}>
                                {table.rows.length}
                              </td>
                              <td className="px-2 py-1 align-top text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2"
                                  disabled={csvImporting}
                                  onClick={() => toggleCsvExclude(i)}
                                  title={excluded ? 'Include again' : 'Exclude from import'}
                                >
                                  {excluded ? (
                                    <>
                                      <Undo2 className="h-3.5 w-3.5" />
                                      Include
                                    </>
                                  ) : (
                                    <>
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Exclude
                                    </>
                                  )}
                                </Button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-border"
                      checked={csvPublish}
                      disabled={csvImporting}
                      onChange={(e) => setCsvPublish(e.target.checked)}
                    />
                    Publish after import
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={csvImporting || linkBusy || csvIncludedCount === 0}
                    onClick={() => void importCsvRows()}
                  >
                    {csvImporting
                      ? 'Importing…'
                      : `Import ${csvIncludedCount} ${csvKind === 'mcq' ? 'MCQ' : csvKind === 'descriptive' ? 'descriptive' : 'DIFFERENCES'}${csvIncludedCount !== 1 ? 's' : ''}`}
                  </Button>
                  {csvExcluded.size > 0 ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={csvImporting}
                      onClick={() => {
                        setCsvExcluded(new Set());
                        setCsvSelected(new Set());
                      }}
                    >
                      Restore all
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={csvImporting}
                    onClick={clearCsvPreview}
                  >
                    Clear
                  </Button>
                </div>
              </>
            )}
          </section>

          <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">Tagged in this chapter</h3>
              <div className="flex flex-wrap gap-2">
                {stats.drafts > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={publishAllBusy || linkBusy}
                    onClick={() => void publishAllDrafts()}
                  >
                    <Upload className="h-4 w-4" />
                    Publish all drafts
                  </Button>
                )}
                <Button asChild size="sm">
                  <Link href={newQuestionHref}>
                    <Plus className="h-4 w-4" />
                    New question
                  </Link>
                </Button>
              </div>
            </div>

            {rows.length > 0 && (
              <div className="flex gap-1">
                {(['all', 'draft', 'published'] as const).map((mode) => (
                  <Button
                    key={mode}
                    type="button"
                    size="sm"
                    variant={filter === mode ? 'default' : 'ghost'}
                    className="h-8"
                    onClick={() => setFilter(mode)}
                  >
                    {mode === 'all' ? 'All' : mode === 'draft' ? 'Drafts' : 'Published'}
                  </Button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="space-y-2">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : filteredRows.length === 0 ? (
              <p className="text-sm text-muted">
                {rows.length === 0
                  ? 'No questions linked yet. Create a new question or link one from the bank below.'
                  : 'No questions match this filter.'}
              </p>
            ) : (
              <ul className="divide-y divide-border rounded-lg border border-border">
                {filteredRows.map((row) => (
                  <li key={row.link_id} className="flex items-start justify-between gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap gap-1.5">
                        <Badge variant="outline">{row.question_type_code}</Badge>
                        <Badge variant="secondary">{row.marks}m</Badge>
                        <Badge variant={row.is_published ? 'default' : 'warning'}>
                          {row.is_published ? 'Published' : 'Draft'}
                        </Badge>
                        <Badge variant="outline">{linkLevelLabel(row.link_level)}</Badge>
                      </div>
                      <p className="whitespace-pre-wrap break-words">{plainText(row.body_en)}</p>
                      <p className="mt-0.5 text-xs text-muted">{row.link_label}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8 px-2"
                        disabled={publishBusyId === row.question_id || linkBusy || publishAllBusy}
                        onClick={() => void togglePublishRow(row)}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        {row.is_published ? 'Unpublish' : 'Publish'}
                      </Button>
                      <Button asChild size="sm" variant="ghost" className="h-8 px-2">
                        <Link href={`/questions/${row.question_id}`}>
                          <ExternalLink className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit question</span>
                        </Link>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-destructive"
                        disabled={linkBusy || publishAllBusy}
                        onClick={() => void unlinkRow(row)}
                      >
                        Remove
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3 rounded-lg border border-dashed border-border p-4">
            <h3 className="text-sm font-semibold">Link existing question</h3>
            <p className="text-xs text-muted">
              Search the question bank, then tag to this chapter, a rule, sub-rule, or regulation.
            </p>

            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted" />
              <Input
                className="pl-9"
                placeholder="Search questions…"
                value={searchQ}
                disabled={linkBusy}
                onChange={(e) => setSearchQ(e.target.value)}
              />
            </div>

            {searching ? (
              <Skeleton className="h-10 w-full" />
            ) : searchResults.length > 0 ? (
              <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-border">
                {searchResults.map((q) => (
                  <li key={q.id}>
                    <button
                      type="button"
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-muted/50 ${
                        selectedQuestionId === q.id ? 'bg-primary-muted' : ''
                      }`}
                      onClick={() => setSelectedQuestionId(q.id)}
                    >
                      <div className="mb-0.5 flex gap-1">
                        <Badge variant="outline" className="text-[10px]">
                          {q.question_type_code}
                        </Badge>
                        {!q.is_published && (
                          <Badge variant="warning" className="text-[10px]">
                            Draft
                          </Badge>
                        )}
                      </div>
                      <span className="whitespace-pre-wrap break-words">{plainText(q.body_en)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : searchQ.trim().length >= 2 ? (
              <p className="text-sm text-muted">No questions found.</p>
            ) : null}

            {selectedQuestionId && (
              <div className="space-y-3 border-t border-border pt-3">
                <div className="space-y-1.5">
                  <Label>Link level</Label>
                  <select
                    className="ibas-select"
                    value={linkLevel}
                    disabled={linkBusy}
                    onChange={(e) => {
                      const level = e.target.value as QuestionLinkLevel | '';
                      setLinkLevel(level);
                      setTopicId('');
                      setSubTopicId('');
                      setRegulationId('');
                    }}
                  >
                    <option value="">— Select —</option>
                    {QUESTION_LINK_LEVELS.map((l) => (
                      <option key={l} value={l}>
                        {l === 'chapter' ? 'Chapter' : l === 'rule' ? 'Rule / topic' : 'Sub-rule'}
                      </option>
                    ))}
                  </select>
                </div>

                {(linkLevel === 'rule' || linkLevel === 'sub_rule') && (
                  <div className="space-y-1.5">
                    <Label>Rule</Label>
                    <select
                      className="ibas-select"
                      value={topicId}
                      disabled={linkBusy}
                      onChange={(e) => {
                        setTopicId(e.target.value);
                        setSubTopicId('');
                        setRegulationId('');
                      }}
                    >
                      <option value="">— Select rule —</option>
                      {chapter.topics.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.rule_number}
                          {t.name ? ` — ${t.name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linkLevel === 'sub_rule' && (
                  <div className="space-y-1.5">
                    <Label>Sub-rule</Label>
                    <select
                      className="ibas-select"
                      value={subTopicId}
                      disabled={linkBusy || !topicId}
                      onChange={(e) => setSubTopicId(e.target.value)}
                    >
                      <option value="">— Select sub-rule —</option>
                      {subTopics.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.rule_number ? `${st.rule_number}` : ''}
                          {st.name ? ` — ${st.name}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {linkLevel !== 'chapter' && topicId && (
                  <div className="space-y-1.5">
                    <Label>Regulation (optional)</Label>
                    <select
                      className="ibas-select"
                      value={regulationId}
                      disabled={linkBusy}
                      onChange={(e) => setRegulationId(e.target.value)}
                    >
                      <option value="">— Optional —</option>
                      {regulations.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.regulation_no} — {r.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Button
                  type="button"
                  size="sm"
                  disabled={linkBusy || !linkLevel}
                  onClick={() => void linkSelectedQuestion()}
                >
                  Link to chapter
                </Button>
              </div>
            )}
          </section>
        </div>

        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={newQuestionHref}>
              <Plus className="h-4 w-4" />
              Add question for chapter
            </Link>
          </Button>
          <Button type="button" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
