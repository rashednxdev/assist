'use client';

import { useEffect, useState } from 'react';
import type { ToolkitKind } from '@ibas/shared-constants';
import type { ToolkitCategory } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';

let cache: Promise<ToolkitCategory[]> | null = null;

function load(): Promise<ToolkitCategory[]> {
  cache ??= apiFetch<{ data: ToolkitCategory[] }>('/toolkit/categories?all=true')
    .then((r) => r.data)
    .catch(() => {
      cache = null;
      return [];
    });
  return cache;
}

/** Drops the cached list after an admin edits categories. */
export function invalidateToolkitCategories() {
  cache = null;
}

/** All categories (admins also get inactive ones); `forKind` lists active ones for a type. */
export function useToolkitCategories() {
  const [categories, setCategories] = useState<ToolkitCategory[]>([]);

  useEffect(() => {
    let alive = true;
    void load().then((list) => {
      if (alive) setCategories(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const forKind = (kind: ToolkitKind, keep?: string) => categories.filter((c) => c.kinds.includes(kind) && (c.is_active || c.code === keep));
  return { categories, forKind };
}
