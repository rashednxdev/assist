/** Known static reference pages available to attach to a rule. */
export const STATIC_REF_PAGE_OPTIONS = [
  {
    label: 'JSI 2016 P',
    href: '/static-ref/jsi-2016-p',
    embedSrc: '/static-ref/jsi-2016-p/index.html',
  },
] as const;

/**
 * Resolve an iframe-friendly URL for a stored content_link.
 * App routes under /static-ref/<slug> embed their public index.html.
 */
export function resolveContentEmbedSrc(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return '';

  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const known = STATIC_REF_PAGE_OPTIONS.find(
    (o) => o.href === trimmed || o.embedSrc === trimmed || trimmed.startsWith(`${o.href}/`),
  );
  if (known) return known.embedSrc;

  if (trimmed.startsWith('/static-ref/') && !trimmed.endsWith('.html')) {
    const base = trimmed.replace(/\/$/, '');
    return `${base}/index.html`;
  }

  return trimmed;
}

export function resolveContentOpenHref(link: string): string {
  const trimmed = link.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const known = STATIC_REF_PAGE_OPTIONS.find(
    (o) => o.href === trimmed || o.embedSrc === trimmed,
  );
  if (known) return known.href;

  return trimmed;
}
