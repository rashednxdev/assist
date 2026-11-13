'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  Unlink,
} from 'lucide-react';
import { sanitizeRichHtml } from '@ibas/shared-types';

export const SALARY_RICH_CLASS =
  'text-sm leading-relaxed text-slate-800 [&_a]:font-semibold [&_a]:text-emerald-800 [&_a]:underline [&_blockquote]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-300 [&_blockquote]:pl-3 [&_blockquote]:italic [&_h1]:mb-2 [&_h1]:mt-3 [&_h1]:text-2xl [&_h1]:font-extrabold [&_h1]:leading-tight [&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:leading-snug [&_h3]:mb-1.5 [&_h3]:mt-2.5 [&_h3]:text-lg [&_h3]:font-semibold [&_h4]:mb-1 [&_h4]:mt-2 [&_h4]:text-base [&_h4]:font-semibold [&_hr]:my-3 [&_li]:my-0.5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5';

function ToolButton({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      className="inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-900"
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const emitted = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('https://');

  useEffect(() => {
    const editor = ref.current;
    if (!editor || value === emitted.current) return;
    editor.innerHTML = value;
    emitted.current = value;
  }, [value]);

  function rememberRange() {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
    const range = selection.getRangeAt(0);
    if (ref.current?.contains(range.commonAncestorContainer)) savedRange.current = range.cloneRange();
  }

  function emit() {
    const html = ref.current?.innerHTML ?? '';
    emitted.current = html;
    onChange(html);
  }

  function run(command: string, arg?: string) {
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
    document.execCommand(command, false, arg);
    emit();
  }

  function formatBlock(tag: string) {
    run('formatBlock', `<${tag}>`);
    const current = document.queryCommandValue('formatBlock').replace(/[<>]/g, '').toLowerCase();
    if (current !== tag) run('formatBlock', tag);
  }

  function applyLink() {
    const href = linkUrl.trim();
    const safe = sanitizeRichHtml(`<a href="${href.replace(/"/g, '')}">x</a>`);
    const kept = /href="([^"]*)"/.exec(safe)?.[1] ?? '';
    if (!kept) return;
    run('createLink', kept);
    setLinkOpen(false);
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-slate-50 px-1.5 py-1">
        <ToolButton title="Bold" onClick={() => run('bold')}>
          <Bold className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Italic" onClick={() => run('italic')}>
          <Italic className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Underline" onClick={() => run('underline')}>
          <Underline className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Strikethrough" onClick={() => run('strikeThrough')}>
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolButton title="Heading 1" onClick={() => formatBlock('h1')}>
          H1
        </ToolButton>
        <ToolButton title="Heading 2" onClick={() => formatBlock('h2')}>
          H2
        </ToolButton>
        <ToolButton title="Heading 3" onClick={() => formatBlock('h3')}>
          H3
        </ToolButton>
        <ToolButton title="Heading 4" onClick={() => formatBlock('h4')}>
          H4
        </ToolButton>
        <ToolButton title="Paragraph" onClick={() => formatBlock('p')}>
          P
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolButton title="Align left" onClick={() => run('justifyLeft')}>
          <AlignLeft className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Align center" onClick={() => run('justifyCenter')}>
          <AlignCenter className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Align right" onClick={() => run('justifyRight')}>
          <AlignRight className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Justify" onClick={() => run('justifyFull')}>
          <AlignJustify className="h-3.5 w-3.5" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolButton title="Bulleted list" onClick={() => run('insertUnorderedList')}>
          <List className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Numbered list" onClick={() => run('insertOrderedList')}>
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Quote" onClick={() => formatBlock('blockquote')}>
          <Quote className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton
          title="Link"
          onClick={() => {
            rememberRange();
            setLinkOpen((open) => !open);
          }}
        >
          <Link2 className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Remove link" onClick={() => run('unlink')}>
          <Unlink className="h-3.5 w-3.5" />
        </ToolButton>
        <span className="mx-1 h-5 w-px bg-border" />
        <ToolButton title="Clear formatting" onClick={() => run('removeFormat')}>
          <Eraser className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Undo" onClick={() => run('undo')}>
          <Undo2 className="h-3.5 w-3.5" />
        </ToolButton>
        <ToolButton title="Redo" onClick={() => run('redo')}>
          <Redo2 className="h-3.5 w-3.5" />
        </ToolButton>
      </div>
      {linkOpen ? (
        <div className="flex gap-2 border-b border-border bg-white px-2 py-2">
          <input
            value={linkUrl}
            onChange={(event) => setLinkUrl(event.target.value)}
            placeholder="https://"
            className="h-8 min-w-0 flex-1 rounded-md border border-border px-2 text-sm outline-none focus:ring-2 focus:ring-emerald-200"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                applyLink();
              }
            }}
          />
          <button type="button" className="rounded-md bg-emerald-700 px-3 text-xs font-semibold text-white" onClick={applyLink}>
            Add link
          </button>
        </div>
      ) : null}
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={placeholder || 'Instructions'}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder || 'Write the instructions…'}
        className={`${SALARY_RICH_CLASS} min-h-64 px-3 py-2 outline-none empty:before:text-slate-400 empty:before:content-[attr(data-placeholder)]`}
        onMouseUp={rememberRange}
        onKeyUp={rememberRange}
        onInput={emit}
        onPaste={(event) => {
          event.preventDefault();
          const html = event.clipboardData.getData('text/html');
          const text = event.clipboardData.getData('text/plain');
          const clean = html ? sanitizeRichHtml(html) : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>');
          document.execCommand('insertHTML', false, clean);
          emit();
        }}
      />
    </div>
  );
}

export function RichHtmlView({ html, className = '' }: { html: string; className?: string }) {
  const safe = sanitizeRichHtml(html);
  if (!safe.trim()) return null;
  return <div className={`${SALARY_RICH_CLASS} ${className}`} dangerouslySetInnerHTML={{ __html: safe }} />;
}
