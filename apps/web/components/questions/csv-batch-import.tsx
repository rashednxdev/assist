'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { FileUp, Trash2, Undo2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import {
  parseMcqCsv,
  parseDescriptiveCsv,
  parseDifferencesCsv,
  type ParsedMcqCsvRow,
  type ParsedDescriptiveCsvRow,
  type ParsedDifferencesCsvRow,
} from '@/lib/mcq-csv';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

type CsvImportKind = 'mcq' | 'descriptive' | 'differences';

function plainText(html: string) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Batch question+answer import from a CSV file (MCQ, Descriptive, or DIFFERENCES), always
 * scoped to one book chapter. Self-contained — mount it fresh (e.g. via a `key`) whenever the
 * target chapter changes so its preview state doesn't leak between chapters.
 */
export function CsvBatchImport({
  bookChapterId,
  onImported,
}: {
  /** Omit to import standalone questions with no chapter link. */
  bookChapterId?: string;
  onImported?: () => void;
}) {
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [csvKind, setCsvKind] = useState<CsvImportKind>('mcq');
  const [csvMcqRows, setCsvMcqRows] = useState<ParsedMcqCsvRow[]>([]);
  const [csvDescRows, setCsvDescRows] = useState<ParsedDescriptiveCsvRow[]>([]);
  const [csvDiffRows, setCsvDiffRows] = useState<ParsedDifferencesCsvRow[]>([]);
  const [csvExcluded, setCsvExcluded] = useState<Set<number>>(() => new Set());
  const [csvSelected, setCsvSelected] = useState<Set<number>>(() => new Set());
  const [csvParseNotes, setCsvParseNotes] = useState<string[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  const [csvDescTypeId, setCsvDescTypeId] = useState('');
  const [csvDiffTypeId, setCsvDiffTypeId] = useState('');
  const [questionTypes, setQuestionTypes] = useState<
    Array<{ id: string; name: string; code: string; has_options: boolean }>
  >([]);
  const csvInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
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
  }, []);

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
          ...(bookChapterId ? { book_chapter_id: bookChapterId } : {}),
          rows,
          ...(csvKind === 'descriptive' ? { question_type_id: csvDescTypeId } : {}),
          ...(csvKind === 'differences' ? { question_type_id: csvDiffTypeId } : {}),
        }),
      });
      const { created_count, failed_count, failed } = res.data;
      const label = csvKind === 'mcq' ? 'MCQ' : csvKind === 'descriptive' ? 'descriptive question' : 'DIFFERENCES question';
      const parts = [
        `Imported ${created_count} ${label}${created_count !== 1 ? 's' : ''} as draft${created_count !== 1 ? 's' : ''}`,
      ];
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
        onImported?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV import failed');
    } finally {
      setCsvImporting(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-dashed border-border p-4">
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}
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
          {csvRowCount > 0 ? ` · ${csvIncludedCount} of ${csvRowCount} question(s) ready` : ''}
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
                          excluded ? 'bg-muted/30 opacity-55' : selected ? 'bg-primary-muted/40' : ''
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
                          excluded ? 'bg-muted/30 opacity-55' : selected ? 'bg-primary-muted/40' : ''
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
                          excluded ? 'bg-muted/30 opacity-55' : selected ? 'bg-primary-muted/40' : ''
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
            <p className="text-xs text-muted">
              Imported questions always start as drafts — submit them for quality check to publish.
            </p>
            <Button
              type="button"
              size="sm"
              disabled={csvImporting || csvIncludedCount === 0}
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
  );
}
