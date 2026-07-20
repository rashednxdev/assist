/**
 * Minimal RFC4180-style CSV parser (handles quotes, commas, CRLF).
 * Returns rows of string cells (including header).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;
  const input = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    const next = input[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(cell);
      cell = '';
      continue;
    }
    if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
      continue;
    }
    if (ch === '\r') continue;
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((r) => r.some((c) => c.trim().length > 0));
}

function normalizeHeader(h: string) {
  return h
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

const MCQ_HEADER_ALIASES: Record<string, string> = {
  question: 'question',
  questions: 'question',
  body: 'question',
  stem: 'question',
  option_a: 'option_a',
  optiona: 'option_a',
  a: 'option_a',
  option_b: 'option_b',
  optionb: 'option_b',
  b: 'option_b',
  option_c: 'option_c',
  optionc: 'option_c',
  c: 'option_c',
  option_d: 'option_d',
  optiond: 'option_d',
  d: 'option_d',
  correct_option: 'correct_option',
  correct: 'correct_option',
  answer: 'correct_option',
  correct_answer: 'correct_option',
  explanation: 'explanation',
  explain: 'explanation',
};

export type ParsedMcqCsvRow = {
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: string;
  explanation: string;
};

export function parseMcqCsv(text: string): { rows: ParsedMcqCsvRow[]; errors: string[] } {
  const table = parseCsv(text);
  const errors: string[] = [];
  if (table.length < 2) {
    return { rows: [], errors: ['CSV must include a header row and at least one question row'] };
  }

  const headerCells = table[0]!.map(normalizeHeader);
  const index: Partial<Record<keyof ParsedMcqCsvRow, number>> = {};
  headerCells.forEach((h, i) => {
    const key = MCQ_HEADER_ALIASES[h];
    if (key && index[key as keyof ParsedMcqCsvRow] === undefined) {
      index[key as keyof ParsedMcqCsvRow] = i;
    }
  });

  const required: (keyof ParsedMcqCsvRow)[] = [
    'question',
    'option_a',
    'option_b',
    'option_c',
    'option_d',
    'correct_option',
  ];
  for (const key of required) {
    if (index[key] === undefined) {
      errors.push(`Missing required column: ${key}`);
    }
  }
  if (errors.length) return { rows: [], errors };

  const rows: ParsedMcqCsvRow[] = [];
  for (let r = 1; r < table.length; r++) {
    const cells = table[r]!;
    const get = (key: keyof ParsedMcqCsvRow) => (cells[index[key]!] ?? '').trim();
    const question = get('question');
    if (!question) {
      errors.push(`Row ${r + 1}: empty question — skipped`);
      continue;
    }
    rows.push({
      question,
      option_a: get('option_a'),
      option_b: get('option_b'),
      option_c: get('option_c'),
      option_d: get('option_d'),
      correct_option: get('correct_option'),
      explanation: index.explanation !== undefined ? get('explanation') : '',
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('No question rows found in CSV');
  }

  return { rows, errors };
}

const DESC_HEADER_ALIASES: Record<string, keyof ParsedDescriptiveCsvRow> = {
  question: 'question',
  questions: 'question',
  body: 'question',
  stem: 'question',
  title: 'title',
  model_answer_title: 'title',
  answer_title: 'title',
  description: 'description',
  details: 'description',
  model_answer: 'description',
  model_answer_description: 'description',
  answer_description: 'description',
  note: 'note',
  model_answer_note: 'note',
  answer_note: 'note',
  note_reference: 'note',
  reference: 'note',
  notes: 'note',
};

export type ParsedDescriptiveCsvRow = {
  question: string;
  title: string;
  description: string;
  note: string;
};

/**
 * Descriptive CSV: question, title, description, note.
 * Supports header aliases, or positional columns (1–4) when headers are absent.
 * Empty title/description/note fields are kept as '' and ignored on import.
 */
export function parseDescriptiveCsv(text: string): {
  rows: ParsedDescriptiveCsvRow[];
  errors: string[];
} {
  const table = parseCsv(text);
  const errors: string[] = [];
  if (table.length === 0) {
    return { rows: [], errors: ['CSV is empty'] };
  }

  const headerCells = table[0]!.map(normalizeHeader);
  const index: Partial<Record<keyof ParsedDescriptiveCsvRow, number>> = {};
  headerCells.forEach((h, i) => {
    const key = DESC_HEADER_ALIASES[h];
    if (key && index[key] === undefined) index[key] = i;
  });

  const hasQuestionHeader = index.question !== undefined;
  let dataStart = 1;

  if (!hasQuestionHeader) {
    // Positional: col1 question, col2 title, col3 description, col4 note
    index.question = 0;
    index.title = 1;
    index.description = 2;
    index.note = 3;
    dataStart = 0;
  } else {
    if (index.title === undefined) index.title = -1;
    if (index.description === undefined) index.description = -1;
    if (index.note === undefined) index.note = -1;
  }

  const rows: ParsedDescriptiveCsvRow[] = [];
  for (let r = dataStart; r < table.length; r++) {
    const cells = table[r]!;
    const get = (key: keyof ParsedDescriptiveCsvRow) => {
      const col = index[key];
      if (col === undefined || col < 0) return '';
      return (cells[col] ?? '').trim();
    };
    const question = get('question');
    if (!question) {
      errors.push(`Row ${r + 1}: empty question — skipped`);
      continue;
    }
    rows.push({
      question,
      title: get('title'),
      description: get('description'),
      note: get('note'),
    });
  }

  if (rows.length === 0) {
    errors.push(errors.length ? errors[0]! : 'No question rows found in CSV');
    return { rows: [], errors };
  }

  return { rows, errors };
}

type DifferencesCsvKey =
  | 'question_no'
  | 'question'
  | 'feature_header'
  | 'column_1'
  | 'column_2'
  | 'column_3'
  | 'column_4'
  | 'column_5'
  | 'column_6'
  | 'feature'
  | 'value_1'
  | 'value_2'
  | 'value_3'
  | 'value_4'
  | 'value_5'
  | 'value_6';

const DIFFERENCES_HEADER_ALIASES: Record<string, DifferencesCsvKey> = {
  question_no: 'question_no',
  question_number: 'question_no',
  q_no: 'question_no',
  no: 'question_no',
  group: 'question_no',
  question: 'question',
  questions: 'question',
  body: 'question',
  stem: 'question',
  feature_header: 'feature_header',
  header: 'feature_header',
  column_1: 'column_1',
  col1: 'column_1',
  column1: 'column_1',
  column_2: 'column_2',
  col2: 'column_2',
  column2: 'column_2',
  column_3: 'column_3',
  col3: 'column_3',
  column3: 'column_3',
  column_4: 'column_4',
  col4: 'column_4',
  column4: 'column_4',
  column_5: 'column_5',
  col5: 'column_5',
  column5: 'column_5',
  column_6: 'column_6',
  col6: 'column_6',
  column6: 'column_6',
  feature: 'feature',
  item: 'feature',
  row_feature: 'feature',
  value_1: 'value_1',
  val1: 'value_1',
  value1: 'value_1',
  value_2: 'value_2',
  val2: 'value_2',
  value2: 'value_2',
  value_3: 'value_3',
  val3: 'value_3',
  value3: 'value_3',
  value_4: 'value_4',
  val4: 'value_4',
  value4: 'value_4',
  value_5: 'value_5',
  val5: 'value_5',
  value5: 'value_5',
  value_6: 'value_6',
  val6: 'value_6',
  value6: 'value_6',
};

const DIFFERENCES_COLUMN_KEYS: DifferencesCsvKey[] = [
  'column_1',
  'column_2',
  'column_3',
  'column_4',
  'column_5',
  'column_6',
];
const DIFFERENCES_VALUE_KEYS: DifferencesCsvKey[] = [
  'value_1',
  'value_2',
  'value_3',
  'value_4',
  'value_5',
  'value_6',
];

export type ParsedDifferencesCsvRow = {
  question: string;
  model_answer_comparison: {
    feature_header?: string;
    columns: string[];
    rows: Array<{ feature: string; values: string[] }>;
  };
};

/**
 * DIFFERENCES CSV: one row per comparison-table feature row, grouped by `question_no`.
 * `question`, `feature_header`, and `column_1..column_6` only need to be filled on a group's
 * first row — later rows in the same group leave those blank. Columns are read contiguously
 * from column_1 and stop at the first blank (no gaps), matching the admin comparison editor.
 */
export function parseDifferencesCsv(text: string): {
  rows: ParsedDifferencesCsvRow[];
  errors: string[];
} {
  const table = parseCsv(text);
  const errors: string[] = [];
  if (table.length < 2) {
    return { rows: [], errors: ['CSV must include a header row and at least one data row'] };
  }

  const headerCells = table[0]!.map(normalizeHeader);
  const index: Partial<Record<DifferencesCsvKey, number>> = {};
  headerCells.forEach((h, i) => {
    const key = DIFFERENCES_HEADER_ALIASES[h];
    if (key && index[key] === undefined) index[key] = i;
  });

  if (index.question_no === undefined) errors.push('Missing required column: question_no');
  if (index.question === undefined) errors.push('Missing required column: question');
  if (index.feature === undefined) errors.push('Missing required column: feature');
  if (index.column_1 === undefined || index.column_2 === undefined) {
    errors.push('Missing required columns: column_1 and column_2');
  }
  if (index.value_1 === undefined || index.value_2 === undefined) {
    errors.push('Missing required columns: value_1 and value_2');
  }
  if (errors.length) return { rows: [], errors };

  const get = (cells: string[], key: DifferencesCsvKey) => {
    const col = index[key];
    if (col === undefined) return '';
    return (cells[col] ?? '').trim();
  };

  type Group = {
    question: string;
    feature_header: string;
    columns: string[];
    rows: Array<{ feature: string; values: string[] }>;
  };
  const groups = new Map<string, Group>();
  const order: string[] = [];

  for (let r = 1; r < table.length; r++) {
    const cells = table[r]!;
    const groupKey = get(cells, 'question_no');
    if (!groupKey) {
      errors.push(`Row ${r + 1}: empty question_no — skipped`);
      continue;
    }

    let group = groups.get(groupKey);
    if (!group) {
      group = { question: '', feature_header: '', columns: [], rows: [] };
      groups.set(groupKey, group);
      order.push(groupKey);
    }

    const question = get(cells, 'question');
    if (question && !group.question) group.question = question;

    const featureHeader = get(cells, 'feature_header');
    if (featureHeader && !group.feature_header) group.feature_header = featureHeader;

    if (group.columns.length === 0) {
      const columns: string[] = [];
      for (const key of DIFFERENCES_COLUMN_KEYS) {
        const value = get(cells, key);
        if (!value) break;
        columns.push(value);
      }
      if (columns.length > 0) group.columns = columns;
    }

    const feature = get(cells, 'feature');
    const values = DIFFERENCES_VALUE_KEYS.slice(0, Math.max(group.columns.length, 2)).map((key) =>
      get(cells, key),
    );
    if (feature || values.some(Boolean)) {
      group.rows.push({ feature, values });
    }
  }

  const rows: ParsedDifferencesCsvRow[] = [];
  for (const key of order) {
    const group = groups.get(key)!;
    if (!group.question) {
      errors.push(`Question group "${key}": missing question text — skipped`);
      continue;
    }
    if (group.columns.length < 2) {
      errors.push(`Question group "${key}": needs at least 2 columns (column_1, column_2) — skipped`);
      continue;
    }
    if (group.rows.length === 0) {
      errors.push(`Question group "${key}": no feature rows — skipped`);
      continue;
    }
    rows.push({
      question: group.question,
      model_answer_comparison: {
        feature_header: group.feature_header || undefined,
        columns: group.columns,
        rows: group.rows.map((row) => ({
          feature: row.feature,
          values: group.columns.map((_, i) => row.values[i] ?? ''),
        })),
      },
    });
  }

  if (rows.length === 0 && errors.length === 0) {
    errors.push('No question groups found in CSV');
  }

  return { rows, errors };
}
