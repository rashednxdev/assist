'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

interface UserOption {
  id: string;
  full_name_en: string;
  email: string;
  phone: string;
}

/**
 * Search-and-select picker for targeting specific users. Mirrors McqQuestionsPanel's
 * search/paginate/checkbox pattern, pointed at GET /users?q=... instead of the question bank.
 */
export function UserPicker({
  selectedIds,
  onChange,
}: {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, UserOption>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setLoading(true);
        try {
          const params = new URLSearchParams({ limit: '100', sort: 'paid' });
          if (search.trim()) params.set('q', search.trim());
          const res = await apiFetch<{ data: UserOption[] }>(`/users?${params.toString()}`);
          if (!cancelled) setResults(res.data);
        } catch {
          if (!cancelled) setResults([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [search]);

  function toggle(user: UserOption) {
    const next = new Map(selectedUsers);
    if (next.has(user.id)) {
      next.delete(user.id);
    } else {
      next.set(user.id, user);
    }
    setSelectedUsers(next);
    onChange([...next.keys()]);
  }

  function remove(id: string) {
    const next = new Map(selectedUsers);
    next.delete(id);
    setSelectedUsers(next);
    onChange([...next.keys()]);
  }

  return (
    <div className="space-y-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {[...selectedUsers.values()].map((u) => (
            <Badge key={u.id} variant="secondary" className="gap-1 pr-1">
              {u.full_name_en}
              <button
                type="button"
                onClick={() => remove(u.id)}
                className="rounded-full p-0.5 hover:bg-slate-200"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search users by name, email, or phone..."
      />
      <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {loading ? (
          <p className="text-sm text-muted">Searching...</p>
        ) : results.length === 0 ? (
          <p className="text-sm text-muted">No users found.</p>
        ) : (
          results.map((u) => (
            <label
              key={u.id}
              className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={selectedUsers.has(u.id)}
                onChange={() => toggle(u)}
              />
              <span className="min-w-0 flex-1">
                {u.full_name_en}
                <span className="ml-2 text-xs text-muted">{u.email}</span>
              </span>
            </label>
          ))
        )}
      </div>
    </div>
  );
}
