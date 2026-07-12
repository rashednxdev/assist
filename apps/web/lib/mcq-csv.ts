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

const HEADER_ALIASES: Record<string, string> = {
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
    const key = HEADER_ALIASES[h];
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
