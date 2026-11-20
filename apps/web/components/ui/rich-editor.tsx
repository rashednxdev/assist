'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Code2,
  Eraser,
  Highlighter,
  Italic,
  Link2,
  List,
  ListOrdered,
  Maximize2,
  Minimize2,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Underline,
  Undo2,
  Unlink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isRichHtmlEmpty, sanitizeEditorHtml } from '@/lib/rich-html';

function Tb({
  title,
  onClick,
  disabled,
  active,
  children,
  className,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      className={cn(
        'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-xs font-semibold text-[#0a2f5b] transition hover:bg-[#eaf4fc] disabled:cursor-not-allowed disabled:opacity-40',
        active && 'bg-[#d7e8f8]',
        className,
      )}
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <span className="mx-1 h-5 w-px bg-[#d7e4ee]" aria-hidden />;
}

function cellOf(node: Node | null, editor: HTMLElement): HTMLTableCellElement | null {
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const cell = el?.closest('td,th');
  return cell && editor.contains(cell) ? (cell as HTMLTableCellElement) : null;
}

function closestIn(node: Node | null, editor: HTMLElement, selector: string): Element | null {
  if (!node) return null;
  const el = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  const hit = el?.closest(selector);
  return hit && editor.contains(hit) ? hit : null;
}

function newCell(tag: string): HTMLElement {
  const el = document.createElement(tag);
  el.innerHTML = '<br>';
  return el;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Full rich text editor: headings, bold/italic/underline, colors, alignment, bullet and numbered
 * lists, quotes, links, tables (rows, columns, merge, header row), HTML source view and full-screen mode.
 * `value` / `onChange` carry sanitized HTML; an empty document is reported as "".
 */
export function RichEditor({
  value,
  onChange,
  placeholder = 'Write here…',
  minHeight = 220,
  disabled = false,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [inTable, setInTable] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');
  const [tableOpen, setTableOpen] = useState(false);
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [tableHeader, setTableHeader] = useState(true);
  const [source, setSource] = useState(false);
  const [sourceText, setSourceText] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [textColor, setTextColor] = useState('#0a2f5b');
  const [markColor, setMarkColor] = useState('#fff3a3');

  // Push outside changes (open another item, reset after save) into the editor.
  useEffect(() => {
    const editor = ref.current;
    if (!editor || value === emitted.current) return;
    editor.innerHTML = value || '';
    emitted.current = value;
  }, [value]);

  // Remember the caret and whether it sits inside a table.
  useEffect(() => {
    function onSelection() {
      const editor = ref.current;
      const selection = window.getSelection();
      if (!editor || !selection || selection.rangeCount === 0) return;
      const range = selection.getRangeAt(0);
      if (!editor.contains(range.commonAncestorContainer)) return;
      savedRange.current = range.cloneRange();
      setInTable(Boolean(cellOf(range.startContainer, editor)));
    }
    document.addEventListener('selectionchange', onSelection);
    return () => document.removeEventListener('selectionchange', onSelection);
  }, []);

  function emit() {
    const raw = ref.current?.innerHTML ?? '';
    const clean = isRichHtmlEmpty(raw) ? '' : sanitizeEditorHtml(raw);
    emitted.current = clean;
    onChange(clean);
  }

  function restoreSelection() {
    const editor = ref.current;
    if (!editor) return;
    editor.focus();
    const selection = window.getSelection();
    const inside =
      selection && selection.rangeCount > 0 && editor.contains(selection.getRangeAt(0).commonAncestorContainer);
    if (!inside && savedRange.current && selection) {
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    }
  }

  function run(command: string, arg?: string) {
    restoreSelection();
    document.execCommand(command, false, arg);
    emit();
  }

  function runCss(command: string, arg: string) {
    restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, arg);
    document.execCommand('styleWithCSS', false, 'false');
    emit();
  }

  function formatBlock(tag: string) {
    run('formatBlock', `<${tag}>`);
    const current = document.queryCommandValue('formatBlock').replace(/[<>]/g, '').toLowerCase();
    if (current !== tag) run('formatBlock', tag);
  }

  function applyLink() {
    const href = linkUrl.trim();
    const safe = sanitizeEditorHtml(`<a href="${href.replace(/"/g, '')}">x</a>`);
    const kept = /href="([^"]*)"/.exec(safe)?.[1] ?? '';
    if (!kept) return;
    run('createLink', kept);
    setLinkOpen(false);
  }

  function insertTable() {
    const rows = clamp(tableRows, 1, 40);
    const cols = clamp(tableCols, 1, 12);
    let html = '<table><tbody>';
    for (let r = 0; r < rows; r += 1) {
      const cell = tableHeader && r === 0 ? '<th><br></th>' : '<td><br></td>';
      html += `<tr>${cell.repeat(cols)}</tr>`;
    }
    html += '</tbody></table><p><br></p>';
    run('insertHTML', html);
    setTableOpen(false);
  }

  function currentCell(): HTMLTableCellElement | null {
    const editor = ref.current;
    if (!editor) return null;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const hit = cellOf(selection.getRangeAt(0).startContainer, editor);
      if (hit) return hit;
    }
    return savedRange.current ? cellOf(savedRange.current.startContainer, editor) : null;
  }

  function withCell(fn: (cell: HTMLTableCellElement, table: HTMLTableElement) => void) {
    restoreSelection();
    const cell = currentCell();
    const table = cell?.closest('table');
    if (!cell || !table) return;
    fn(cell, table as HTMLTableElement);
    emit();
  }

  function addRow(after: boolean) {
    withCell((cell) => {
      const tr = cell.parentElement as HTMLTableRowElement;
      const next = document.createElement('tr');
      Array.from(tr.cells).forEach((c) => {
        const el = newCell('td') as HTMLTableCellElement;
        if (c.colSpan > 1) el.colSpan = c.colSpan;
        next.appendChild(el);
      });
      tr.parentNode?.insertBefore(next, after ? tr.nextSibling : tr);
    });
  }

  function deleteRow() {
    withCell((cell, table) => {
      cell.parentElement?.remove();
      if (table.rows.length === 0) table.remove();
    });
  }

  function addColumn(after: boolean) {
    withCell((cell, table) => {
      const idx = cell.cellIndex;
      Array.from(table.rows).forEach((row) => {
        const ref = row.cells[idx];
        const el = newCell((ref?.tagName ?? cell.tagName).toLowerCase());
        row.insertBefore(el, after ? (ref?.nextSibling ?? null) : (ref ?? null));
      });
    });
  }

  function deleteColumn() {
    withCell((cell, table) => {
      const idx = cell.cellIndex;
      Array.from(table.rows).forEach((row) => {
        if (row.cells[idx]) row.deleteCell(idx);
      });
      if (!table.querySelector('td,th')) table.remove();
    });
  }

  function toggleHeaderRow() {
    withCell((_cell, table) => {
      const row = table.rows[0];
      if (!row) return;
      const makeHeader = row.cells[0]?.tagName === 'TD';
      Array.from(row.cells).forEach((c) => {
        const tag = makeHeader ? 'th' : 'td';
        if (c.tagName.toLowerCase() === tag) return;
        const el = document.createElement(tag);
        Array.from(c.attributes).forEach((a) => el.setAttribute(a.name, a.value));
        while (c.firstChild) el.appendChild(c.firstChild);
        c.replaceWith(el);
      });
    });
  }

  function mergeRight() {
    withCell((cell) => {
      const next = cell.nextElementSibling as HTMLTableCellElement | null;
      if (!next) return;
      const blank = (el: HTMLElement) => (el.textContent ?? '').trim() === '';
      if (!blank(next)) cell.innerHTML = blank(cell) ? next.innerHTML : `${cell.innerHTML}<br>${next.innerHTML}`;
      cell.colSpan = cell.colSpan + next.colSpan;
      next.remove();
    });
  }

  function splitCell() {
    withCell((cell) => {
      if (cell.colSpan <= 1) return;
      cell.colSpan = cell.colSpan - 1;
      cell.after(newCell(cell.tagName.toLowerCase()));
    });
  }

  function deleteTable() {
    withCell((_cell, table) => table.remove());
  }

  function placeCaret(cell: Element) {
    const selection = window.getSelection();
    if (!selection) return;
    const range = document.createRange();
    range.selectNodeContents(cell);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && expanded) {
      setExpanded(false);
      return;
    }
    if (event.key !== 'Tab') return;
    const editor = ref.current;
    if (!editor) return;
    const selection = window.getSelection();
    const anchor = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).startContainer : null;

    const cell = cellOf(anchor, editor);
    if (cell) {
      event.preventDefault();
      const table = cell.closest('table') as HTMLTableElement;
      const cells = Array.from(table.querySelectorAll('td,th'));
      const i = cells.indexOf(cell);
      if (event.shiftKey) {
        if (cells[i - 1]) placeCaret(cells[i - 1]!);
      } else if (cells[i + 1]) {
        placeCaret(cells[i + 1]!);
      } else {
        const tr = cell.parentElement as HTMLTableRowElement;
        const row = document.createElement('tr');
        Array.from(tr.cells).forEach(() => row.appendChild(newCell('td')));
        tr.parentNode?.insertBefore(row, tr.nextSibling);
        placeCaret(row.cells[0]!);
        emit();
      }
      return;
    }
    if (closestIn(anchor, editor, 'li')) {
      event.preventDefault();
      run(event.shiftKey ? 'outdent' : 'indent');
    }
  }

  function onPaste(event: React.ClipboardEvent<HTMLDivElement>) {
    event.preventDefault();
    const html = event.clipboardData.getData('text/html');
    const text = event.clipboardData.getData('text/plain');
    const clean = html
      ? sanitizeEditorHtml(html)
      : text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .split(/\n{2,}/)
          .map((block) => `<p>${block.replace(/\n/g, '<br>')}</p>`)
          .join('');
    document.execCommand('insertHTML', false, clean);
    emit();
  }

  function toggleSource() {
    if (!source) {
      setSourceText(value);
      setSource(true);
      return;
    }
    const editor = ref.current;
    const clean = isRichHtmlEmpty(sourceText) ? '' : sanitizeEditorHtml(sourceText);
    if (editor) editor.innerHTML = clean;
    emitted.current = clean;
    onChange(clean);
    setSource(false);
  }

  const off = disabled || source;

  return (
    <>
      {expanded ? (
        <div className="fixed inset-0 z-[70] bg-slate-900/50" onClick={() => setExpanded(false)} aria-hidden />
      ) : null}
      <div
        className={cn(
          'flex flex-col overflow-hidden rounded-xl border border-[#d7e4ee] bg-white shadow-xs',
          expanded && 'fixed inset-3 z-[80] shadow-2xl sm:inset-8',
        )}
      >
        <div className="flex flex-wrap items-center gap-0.5 border-b border-[#d7e4ee] bg-[#f4f9fd] px-1.5 py-1">
          <select
            aria-label="Text style"
            disabled={off}
            value=""
            onChange={(event) => {
              if (event.target.value) formatBlock(event.target.value);
            }}
            className="h-8 rounded-md border border-[#d7e4ee] bg-white px-1.5 text-xs font-semibold text-[#0a2f5b] disabled:opacity-40"
          >
            <option value="">Style</option>
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="blockquote">Quote</option>
            <option value="pre">Code block</option>
          </select>
          <Sep />
          <Tb title="Bold (Ctrl+B)" disabled={off} onClick={() => run('bold')}>
            <Bold className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Italic (Ctrl+I)" disabled={off} onClick={() => run('italic')}>
            <Italic className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Underline (Ctrl+U)" disabled={off} onClick={() => run('underline')}>
            <Underline className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Strikethrough" disabled={off} onClick={() => run('strikeThrough')}>
            <Strikethrough className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Subscript" disabled={off} onClick={() => run('subscript')}>
            <Subscript className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Superscript" disabled={off} onClick={() => run('superscript')}>
            <Superscript className="h-3.5 w-3.5" />
          </Tb>
          <label
            title="Text color"
            className={cn(
              'relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-[#eaf4fc]',
              off && 'pointer-events-none opacity-40',
            )}
          >
            <span className="text-xs font-extrabold leading-none text-[#0a2f5b]" style={{ borderBottom: `3px solid ${textColor}` }}>
              A
            </span>
            <input
              type="color"
              aria-label="Text color"
              value={textColor}
              disabled={off}
              onChange={(event) => {
                setTextColor(event.target.value);
                runCss('foreColor', event.target.value);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <label
            title="Highlight color"
            className={cn(
              'relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md hover:bg-[#eaf4fc]',
              off && 'pointer-events-none opacity-40',
            )}
          >
            <Highlighter className="h-3.5 w-3.5 text-[#0a2f5b]" style={{ borderBottom: `3px solid ${markColor}` }} />
            <input
              type="color"
              aria-label="Highlight color"
              value={markColor}
              disabled={off}
              onChange={(event) => {
                setMarkColor(event.target.value);
                runCss('hiliteColor', event.target.value);
              }}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
          </label>
          <Sep />
          <Tb title="Align left" disabled={off} onClick={() => run('justifyLeft')}>
            <AlignLeft className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Align center" disabled={off} onClick={() => run('justifyCenter')}>
            <AlignCenter className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Align right" disabled={off} onClick={() => run('justifyRight')}>
            <AlignRight className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Justify" disabled={off} onClick={() => run('justifyFull')}>
            <AlignJustify className="h-3.5 w-3.5" />
          </Tb>
          <Sep />
          <Tb title="Bulleted list" disabled={off} onClick={() => run('insertUnorderedList')}>
            <List className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Numbered list" disabled={off} onClick={() => run('insertOrderedList')}>
            <ListOrdered className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Quote" disabled={off} onClick={() => formatBlock('blockquote')}>
            <Quote className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Horizontal line" disabled={off} onClick={() => run('insertHorizontalRule')}>
            <Minus className="h-3.5 w-3.5" />
          </Tb>
          <Sep />
          <Tb
            title="Insert link"
            disabled={off}
            active={linkOpen}
            onClick={() => {
              setTableOpen(false);
              setLinkOpen((open) => !open);
            }}
          >
            <Link2 className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Remove link" disabled={off} onClick={() => run('unlink')}>
            <Unlink className="h-3.5 w-3.5" />
          </Tb>
          <Tb
            title="Insert table"
            disabled={off}
            active={tableOpen}
            onClick={() => {
              setLinkOpen(false);
              setTableOpen((open) => !open);
            }}
          >
            <Table2 className="h-3.5 w-3.5" />
          </Tb>
          <Sep />
          <Tb title="Clear formatting" disabled={off} onClick={() => run('removeFormat')}>
            <Eraser className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Undo" disabled={off} onClick={() => run('undo')}>
            <Undo2 className="h-3.5 w-3.5" />
          </Tb>
          <Tb title="Redo" disabled={off} onClick={() => run('redo')}>
            <Redo2 className="h-3.5 w-3.5" />
          </Tb>
          <span className="ml-auto flex items-center gap-0.5">
            <Tb title={source ? 'Back to visual editor' : 'Edit HTML source'} disabled={disabled} active={source} onClick={toggleSource}>
              <Code2 className="h-3.5 w-3.5" />
            </Tb>
            <Tb
              title={expanded ? 'Exit full screen' : 'Full screen'}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Tb>
          </span>
        </div>

        {inTable && !off ? (
          <div className="flex flex-wrap items-center gap-0.5 border-b border-[#d7e4ee] bg-[#eaf4fc] px-1.5 py-1 text-[11px]">
            <span className="px-1.5 font-bold text-[#0a2f5b]">Table</span>
            <Tb title="Add row above" onClick={() => addRow(false)} className="px-2">Row ↑</Tb>
            <Tb title="Add row below" onClick={() => addRow(true)} className="px-2">Row ↓</Tb>
            <Tb title="Delete row" onClick={deleteRow} className="px-2 text-rose-700">Del row</Tb>
            <Sep />
            <Tb title="Add column left" onClick={() => addColumn(false)} className="px-2">Col ←</Tb>
            <Tb title="Add column right" onClick={() => addColumn(true)} className="px-2">Col →</Tb>
            <Tb title="Delete column" onClick={deleteColumn} className="px-2 text-rose-700">Del col</Tb>
            <Sep />
            <Tb title="Toggle header row" onClick={toggleHeaderRow} className="px-2">Header</Tb>
            <Tb title="Merge with the cell on the right" onClick={mergeRight} className="px-2">Merge →</Tb>
            <Tb title="Split merged cell" onClick={splitCell} className="px-2">Split</Tb>
            <Sep />
            <Tb title="Delete table" onClick={deleteTable} className="px-2 text-rose-700">Del table</Tb>
          </div>
        ) : null}

        {linkOpen && !off ? (
          <div className="flex gap-2 border-b border-[#d7e4ee] bg-white px-2 py-2">
            <input
              value={linkUrl}
              onChange={(event) => setLinkUrl(event.target.value)}
              placeholder="https://"
              className="h-8 min-w-0 flex-1 rounded-md border border-[#d7e4ee] px-2 text-sm outline-none focus:border-[#1566b8] focus:ring-2 focus:ring-[#1566b8]/15"
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  applyLink();
                }
              }}
            />
            <button type="button" className="rounded-md bg-[#1566b8] px-3 text-xs font-semibold text-white hover:bg-[#0f5294]" onClick={applyLink}>
              Add link
            </button>
          </div>
        ) : null}

        {tableOpen && !off ? (
          <div className="flex flex-wrap items-center gap-3 border-b border-[#d7e4ee] bg-white px-3 py-2 text-xs text-[#0a2f5b]">
            <label className="flex items-center gap-1.5 font-semibold">
              Rows
              <input
                type="number"
                min={1}
                max={40}
                value={tableRows}
                onChange={(event) => setTableRows(Number(event.target.value))}
                className="h-8 w-16 rounded-md border border-[#d7e4ee] px-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-1.5 font-semibold">
              Columns
              <input
                type="number"
                min={1}
                max={12}
                value={tableCols}
                onChange={(event) => setTableCols(Number(event.target.value))}
                className="h-8 w-16 rounded-md border border-[#d7e4ee] px-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-1.5 font-semibold">
              <input type="checkbox" checked={tableHeader} onChange={(event) => setTableHeader(event.target.checked)} />
              Header row
            </label>
            <button type="button" className="rounded-md bg-[#1566b8] px-3 py-1.5 font-semibold text-white hover:bg-[#0f5294]" onClick={insertTable}>
              Insert table
            </button>
          </div>
        ) : null}

        <div
          ref={ref}
          role="textbox"
          aria-multiline="true"
          aria-label={placeholder}
          contentEditable={!disabled}
          suppressContentEditableWarning
          data-placeholder={placeholder}
          style={expanded ? undefined : { minHeight }}
          className={cn(
            'rich-content rich-editor-surface min-h-0 flex-1 overflow-auto px-4 py-3 text-sm outline-none',
            'empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]',
            source && 'hidden',
            disabled && 'bg-slate-50 opacity-70',
          )}
          onInput={emit}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
        />

        {source ? (
          <textarea
            aria-label="HTML source"
            spellCheck={false}
            value={sourceText}
            onChange={(event) => {
              setSourceText(event.target.value);
              const clean = isRichHtmlEmpty(event.target.value) ? '' : sanitizeEditorHtml(event.target.value);
              emitted.current = null;
              onChange(clean);
            }}
            style={expanded ? undefined : { minHeight }}
            className="min-h-0 flex-1 resize-y bg-slate-50 p-3 font-mono text-xs text-slate-800 outline-none"
          />
        ) : null}
      </div>
    </>
  );
}
