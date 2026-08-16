export function cleanBookLabel(value?: string | null) {
  return (value ?? '')
    .trim()
    .replace(/^(chapter|rule|sub[-\s]?rule)\s*[:.\-]?\s*/i, '')
    .trim();
}

/** Strip admin markup markers for nav titles / plain-string labels. */
export function stripBookMarkup(value?: string | null) {
  return (value ?? '')
    .replace(/\/{4}/g, ' ')
    .replace(/\/{3}/g, ' ')
    .replace(/\/{2}/g, ' ')
    .replace(/\/-{2,}/g, ' ')
    .replace(/\[\]/g, ' ')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chapterHeading(chapter: { chapter_number?: string; name?: string }) {
  const no = cleanBookLabel(chapter.chapter_number);
  const name = stripBookMarkup(cleanBookLabel(chapter.name));
  if (no && name) return `${no}: ${name}`;
  return no || name || 'Chapter';
}

/** Chapter name with markup preserved for BookRichText. */
export function chapterNameForMarkup(chapter: { name?: string }) {
  return cleanBookLabel(chapter.name);
}

export function ruleHeading(rule: { rule_number?: string; name?: string }) {
  const no = cleanBookLabel(rule.rule_number);
  const title = cleanBookLabel(rule.name);
  if (no && title) return `${no} — ${title}`;
  return no || title || 'Rule';
}

export function subRuleHeading(st: { rule_number?: string; name?: string }) {
  const no = cleanBookLabel(st.rule_number);
  const title = cleanBookLabel(st.name);
  if (no && title) return `${no} — ${title}`;
  return no || title || 'Sub-rule';
}

export function stripHtml(html?: string) {
  if (!html?.trim()) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function bookNavTitle(name: string, maxLength = 15) {
  const trimmed = name.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}...`;
}
