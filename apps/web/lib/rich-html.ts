/**
 * Helpers for the rich text editor used on book chapters, rules and sub-rules.
 * Browser-only sanitizer (DOMParser): keeps formatting, tables, lists and alignment;
 * drops scripts, event handlers, unknown tags/attributes and unsafe links.
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr', 'div', 'span',
  'strong', 'b', 'em', 'i', 'u', 's', 'strike', 'sub', 'sup', 'mark', 'code', 'pre',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'ul', 'ol', 'li', 'blockquote',
  'a',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
]);

/** Removed together with everything inside them. */
const DROP_WITH_CONTENT = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'form', 'svg', 'math', 'noscript',
  'textarea', 'button', 'input', 'select', 'option', 'link', 'meta', 'head', 'title', 'template',
]);

const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*[\d.]+\s*)?\)|[a-z]{3,20})$/i;

function safeHref(raw: string): string {
  const value = raw.trim();
  const compact = value.replace(/[\u0000-\u0020]+/g, '').toLowerCase();
  if (!compact) return '';
  if (/^(javascript|data|vbscript):/.test(compact)) return '';
  if (/^https?:\/\//i.test(value) || /^mailto:/i.test(value) || /^tel:/i.test(value)) return value;
  if (value.startsWith('/') && !value.startsWith('//')) return value;
  if (value.startsWith('#')) return value;
  return '';
}

function cleanStyle(raw: string): string {
  const out: string[] = [];
  for (const decl of raw.split(';')) {
    const idx = decl.indexOf(':');
    if (idx < 0) continue;
    const prop = decl.slice(0, idx).trim().toLowerCase();
    const val = decl.slice(idx + 1).trim();
    if (!val) continue;
    if (prop === 'text-align' && /^(left|right|center|justify)$/i.test(val)) out.push(`text-align:${val.toLowerCase()}`);
    else if (prop === 'vertical-align' && /^(top|middle|bottom)$/i.test(val)) out.push(`vertical-align:${val.toLowerCase()}`);
    else if ((prop === 'color' || prop === 'background-color') && COLOR_RE.test(val)) out.push(`${prop}:${val}`);
  }
  return out.join(';');
}

function copyAttrs(from: Element, to: Element, tag: string): void {
  const style = from.getAttribute('style');
  if (style) {
    const clean = cleanStyle(style);
    if (clean) to.setAttribute('style', clean);
  }
  if (tag === 'a') {
    const href = safeHref(from.getAttribute('href') ?? '');
    if (href) {
      to.setAttribute('href', href);
      if (/^https?:/i.test(href)) {
        to.setAttribute('target', '_blank');
        to.setAttribute('rel', 'noopener noreferrer');
      }
    }
  }
  if (tag === 'td' || tag === 'th') {
    for (const name of ['colspan', 'rowspan'] as const) {
      const n = Number.parseInt(from.getAttribute(name) ?? '', 10);
      if (Number.isFinite(n) && n > 1 && n <= 50) to.setAttribute(name, String(n));
    }
  }
}

function cleanChildren(source: Node, target: Node, doc: Document): void {
  source.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      target.appendChild(doc.createTextNode(node.textContent ?? ''));
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const el = node as Element;
    const tag = el.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) return;

    if (tag === 'font') {
      const color = el.getAttribute('color') ?? '';
      if (color && COLOR_RE.test(color)) {
        const span = doc.createElement('span');
        span.setAttribute('style', `color:${color}`);
        cleanChildren(el, span, doc);
        target.appendChild(span);
      } else {
        cleanChildren(el, target, doc);
      }
      return;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      cleanChildren(el, target, doc);
      return;
    }

    const copy = doc.createElement(tag);
    copyAttrs(el, copy, tag);
    if (tag !== 'br' && tag !== 'hr' && tag !== 'col') cleanChildren(el, copy, doc);
    target.appendChild(copy);
  });
}

export function sanitizeEditorHtml(html: string): string {
  if (!html) return '';
  if (typeof DOMParser === 'undefined') return html.replace(/<\/?(script|style|iframe)[^>]*>/gi, '');
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  const holder = parsed.createElement('div');
  cleanChildren(parsed.body, holder, parsed);
  return holder.innerHTML;
}

/** True when there is no visible text and no table / rule / list content. */
export function isRichHtmlEmpty(html?: string | null): boolean {
  const value = (html ?? '').trim();
  if (!value) return true;
  if (typeof DOMParser === 'undefined') return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim() === '';
  const doc = new DOMParser().parseFromString(value, 'text/html');
  if (doc.body.querySelector('table, hr, img, li')) return false;
  return (doc.body.textContent ?? '').replace(/\u00a0/g, ' ').trim() === '';
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Turns stored book text (HTML, or older plain text) into HTML the editor can open. */
export function toEditorHtml(stored?: string | null): string {
  const text = (stored ?? '').trim();
  if (!text) return '';
  if (text.startsWith('<')) return text;
  return text
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
