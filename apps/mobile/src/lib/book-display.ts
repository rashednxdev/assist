export function chapterHeading(chapter: { chapter_number?: string; name: string }) {
  const no = chapter.chapter_number?.trim();
  return no ? `Chapter ${no}: ${chapter.name}` : chapter.name;
}

export function ruleHeading(rule: { rule_number: string; name?: string }) {
  const title = rule.name?.trim();
  return title ? `${rule.rule_number} — ${title}` : rule.rule_number;
}

export function subRuleHeading(st: { rule_number?: string; name?: string }) {
  const no = st.rule_number?.trim();
  const title = st.name?.trim();
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
