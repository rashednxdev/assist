export function cleanBookLabel(value?: string | null) {
  return (value ?? '')
    .trim()
    .replace(/^(chapter|rule|sub[-\s]?rule)\s*[:.\-]?\s*/i, '')
    .trim();
}

export function chapterHeading(chapter: { chapter_number?: string; name: string }) {
  const no = cleanBookLabel(chapter.chapter_number);
  const name = cleanBookLabel(chapter.name) || chapter.name.trim();
  return no ? `${no}: ${name}` : name;
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
