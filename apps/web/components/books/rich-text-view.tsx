/** Renders stored HTML content (from seed/admin). Sanitize in production hardening phase. */
export function RichTextView({ html, className = '' }: { html?: string; className?: string }) {
  if (!html?.trim()) return null;
  return (
    <div
      className={`prose prose-sm max-w-none text-foreground prose-p:leading-relaxed prose-headings:font-semibold ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
