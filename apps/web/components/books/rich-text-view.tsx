import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';

/**
 * Renders stored HTML content (written in the admin RichEditor, or legacy seed/plain text).
 * Styled by `.rich-content` in globals.css so tables, lists, headings and alignment display as authored.
 */
export function RichTextView({ html, className = '' }: { html?: string; className?: string }) {
  const trimmed = html?.trim();
  if (!trimmed) return null;
  const withBreaks = insertBookListMarkerLineBreaks(trimmed, '<br/>');
  const content = withBreaks.startsWith('<') ? withBreaks : `<p>${withBreaks}</p>`;
  return (
    <div
      className={`rich-content max-w-none overflow-x-auto text-sm text-foreground ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
