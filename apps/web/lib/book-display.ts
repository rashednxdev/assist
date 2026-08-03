export function chapterHeading(chapter: { chapter_number?: string; name: string }) {
  const no = chapter.chapter_number?.trim();
  return no ? `Chapter ${no}: ${chapter.name}` : chapter.name;
}

export function ruleHeading(rule: { rule_number?: string; name?: string }) {
  const no = rule.rule_number?.trim();
  const title = rule.name?.trim();
  if (no && title) return `${no} — ${title}`;
  return no || title || 'Rule';
}

export function subRuleHeading(st: { rule_number?: string; name?: string }) {
  const no = st.rule_number?.trim();
  const title = st.name?.trim();
  if (no && title) return `${no} — ${title}`;
  return no || title || 'Sub-rule';
}
