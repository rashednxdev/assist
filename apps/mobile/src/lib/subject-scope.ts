/** Stable cache key: user + current exam-subject allowlist. */
export function questionCacheScopeKey(user: {
  id?: string;
  is_super_admin?: boolean;
  user_type?: string;
  all_exam_subjects?: boolean;
  exam_subject_ids?: string[];
} | null | undefined): string {
  if (!user?.id) return 'none';
  return `${user.id}:${subjectScopeKeyFromUser(user)}`;
}

export function subjectScopeKeyFromUser(user: {
  is_super_admin?: boolean;
  user_type?: string;
  all_exam_subjects?: boolean;
  exam_subject_ids?: string[];
} | null | undefined): string {
  if (!user) return 'none';
  if (user.is_super_admin || user.user_type === 'system_admin' || user.user_type === 'admin') {
    return 'all';
  }
  if (user.all_exam_subjects !== false) return 'all';
  const ids = [...new Set((user.exam_subject_ids ?? []).map(String).filter(Boolean))].sort();
  return ids.length === 0 ? 'none' : ids.join(',');
}

/** `null` = every subject. Empty set = none. */
export function allowedSubjectIdSet(user: {
  is_super_admin?: boolean;
  user_type?: string;
  all_exam_subjects?: boolean;
  exam_subject_ids?: string[];
} | null | undefined): Set<string> | null {
  const key = subjectScopeKeyFromUser(user);
  if (key === 'all') return null;
  if (key === 'none') return new Set();
  return new Set(key.split(','));
}
