import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';

/** Renders stored HTML content (from seed/admin). Sanitize in production hardening phase. */
export function RichTextView({ html, className = '' }: { html?: string; className?: string }) {
  const trimmed = html?.trim();
  if (!trimmed) return null;
  const withBreaks = insertBookListMarkerLineBreaks(trimmed, '<br/>');
  const content = withBreaks.startsWith('<') ? withBreaks : `<p>${withBreaks}</p>`;
  return (
    <div
      className={`prose prose-sm max-w-none text-foreground prose-p:leading-relaxed prose-headings:font-semibold ${className}`}
      dangerouslySetInnerHTML={{ __html: content }}
    />
  );
}
