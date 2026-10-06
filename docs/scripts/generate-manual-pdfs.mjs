/**
 * Split ADMIN_DATA_ENTRY_MANUAL.md into per-module markdown and PDF files.
 * Run: node docs/scripts/generate-manual-pdfs.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const repoRoot = join(root, '..');
const manualPath = join(root, 'ADMIN_DATA_ENTRY_MANUAL.md');
const outDir = join(root, 'manual-pdf');
const cssPath = join(outDir, 'manual-pdf.css');

const SLUGS = {
  1: '01-sign-in-dashboard',
  2: '02-geography',
  3: '03-users',
  4: '04-books-rule-library',
  5: '05-regulations',
  6: '06-questions',
  7: '07-exams',
  8: '08-syllabus',
  9: '09-papers',
  10: '10-workflow',
  11: '11-pdf-to-word-ocr',
  12: '12-audit',
};

function slugifyTitle(title) {
  return title
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);
}

function splitManual(source) {
  const introEnd = source.indexOf('# Module 1');
  const intro = source.slice(0, introEnd).trim();
  const body = source.slice(introEnd);

  const moduleRegex = /^# Module (\d+) — (.+)$/gm;
  const matches = [...body.matchAll(moduleRegex)];

  const modules = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const num = Number(m[1]);
    const title = m[2].trim();
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
    let content = body.slice(start, end).trim();
    if (num === 12) {
      const quickMap = content.indexOf('\n# Quick map:');
      if (quickMap !== -1) content = content.slice(0, quickMap).trim();
    }
    modules.push({ num, title, content });
  }

  const quickMapStart = source.indexOf('# Quick map:');
  const quickMap =
    quickMapStart !== -1
      ? source.slice(quickMapStart).replace(/\*Task manual.*\*$/m, '').trim()
      : '';

  return { intro, modules, quickMap };
}

function wrapModule(num, title, content) {
  return `# iBAS++ Admin Task Manual — Module ${num}: ${title}

${content}

---

*iBAS++ · Module ${num} · Admin data entry task manual · 2026*
`;
}

function wrapIntro(intro, quickMap) {
  return `# iBAS++ Admin Task Manual — Overview

${intro}

---

${quickMap}

---

*iBAS++ · Overview · Admin data entry task manual · 2026*
`;
}

function convertMdToPdf(mdPath, pdfPath) {
  const configPath = join(outDir, 'md-to-pdf.config.json');

  const result = spawnSync(
    'npx',
    ['--yes', 'md-to-pdf', mdPath, '--config-file', configPath],
    { cwd: outDir, shell: true, encoding: 'utf8', timeout: 180000 },
  );

  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `md-to-pdf failed for ${mdPath}`);
  }

  const defaultPdf = mdPath.replace(/\.md$/i, '.pdf');
  if (defaultPdf !== pdfPath && existsSync(defaultPdf)) {
    renameSync(defaultPdf, pdfPath);
  }
}

function main() {
  if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

  const source = readFileSync(manualPath, 'utf8');
  const { intro, modules, quickMap } = splitManual(source);

  const jobs = [];

  const overviewMd = join(outDir, 'Module-00-Overview.md');
  const overviewPdf = join(outDir, 'Module-00-Overview.pdf');
  writeFileSync(overviewMd, wrapIntro(intro, quickMap), 'utf8');
  jobs.push({ md: overviewMd, pdf: overviewPdf, label: 'Overview' });

  for (const mod of modules) {
    const base = `Module-${String(mod.num).padStart(2, '0')}-${slugifyTitle(mod.title)}`;
    const mdPath = join(outDir, `${base}.md`);
    const pdfPath = join(outDir, `${base}.pdf`);
    writeFileSync(mdPath, wrapModule(mod.num, mod.title, mod.content), 'utf8');
    jobs.push({ md: mdPath, pdf: pdfPath, label: `Module ${mod.num}: ${mod.title}` });
  }

  console.log(`Generating ${jobs.length} PDFs in:\n  ${outDir}\n`);

  let failed = false;
  for (const job of jobs) {
    process.stdout.write(`  ${job.label}... `);
    try {
      convertMdToPdf(job.md, job.pdf);
      console.log('OK');
    } catch (err) {
      failed = true;
      console.log('FAILED');
      console.error(`    ${err.message}`);
    }
  }

  if (failed) {
    process.exitCode = 1;
    console.error('\nSome PDFs failed to generate.');
  } else {
    console.log('\nAll PDFs generated successfully.');
  }
}

main();
