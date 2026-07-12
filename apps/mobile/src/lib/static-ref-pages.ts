/** Known static reference pages available to attach to a rule. */
export const STATIC_REF_PAGE_OPTIONS = [
  {
    label: 'JSI 2016 P',
    href: '/static-ref/jsi-2016-p',
    embedSrc: '/static-ref/jsi-2016-p/index.html',
  },
] as const;

/**
 * Resolve an embeddable path/URL for a stored content_link.
 * App routes under /static-ref/<slug> map to their public index.html.
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

export function contentLinkLabel(link: string): string {
  const trimmed = link.trim();
  const known = STATIC_REF_PAGE_OPTIONS.find(
    (o) => o.href === trimmed || o.embedSrc === trimmed || trimmed.startsWith(`${o.href}/`),
  );
  if (known) return known.label;
  if (trimmed.startsWith('/static-ref/')) {
    const slug = trimmed.replace(/^\/static-ref\//, '').replace(/\/$/, '').replace(/\/index\.html$/, '');
    return slug || 'Linked page';
  }
  return 'Linked page';
}

/**
 * Absolute URL for WebView. Relative paths are resolved against EXPO_PUBLIC_WEB_URL.
 */
export function resolveContentAbsoluteUrl(link: string): string {
  const embed = resolveContentEmbedSrc(link);
  if (!embed) return '';
  if (/^https?:\/\//i.test(embed)) return embed;

  const webBase = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://ibas-web.onrender.com')
    .trim()
    .replace(/\/+$/, '');
  return `${webBase}${embed.startsWith('/') ? embed : `/${embed}`}`;
}
