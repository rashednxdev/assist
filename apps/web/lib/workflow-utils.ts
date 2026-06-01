/** Uppercase slug for task codes (A-Z, 0-9, underscore). */
export function slugifyTaskCode(name: string): string {
  return (
    name
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 24) || 'TASK'
  );
}

/** Client-side unique code — backend also deduplicates if needed. */
export function generateTaskCode(name?: string): string {
  const base = slugifyTaskCode(name || 'TASK');
  const suffix = Date.now().toString(36).toUpperCase().slice(-5);
  return `${base}_${suffix}`.slice(0, 30);
}

export function moduleId(mod: { _id?: string; id?: string }): string {
  return mod._id ?? mod.id ?? '';
}
