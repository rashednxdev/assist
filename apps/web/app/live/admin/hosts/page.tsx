'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Pencil, Plus, Trash2, UserRound } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface LiveHostRow {
  id: string;
  user_id: string;
  display_name: string;
  bio?: string;
  is_active: boolean;
  user_name?: string;
  user_email?: string;
  user_phone?: string;
}

interface UserPick {
  id: string;
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone?: string;
}

export default function LiveHostsAdminPage() {
  const [items, setItems] = useState<LiveHostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState<UserPick[]>([]);
  const [selectedUser, setSelectedUser] = useState<UserPick | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editActive, setEditActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ data: LiveHostRow[] }>('/live-streams/admin/hosts');
      setItems(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load hosts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const params = new URLSearchParams({ status: 'active', limit: '20' });
          if (userQuery.trim()) params.set('q', userQuery.trim());
          const res = await apiFetch<{ data: UserPick[] }>(`/users?${params}`);
          if (!cancelled) setUserResults(res.data);
        } catch {
          if (!cancelled) setUserResults([]);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [userQuery]);

  function pickUser(user: UserPick) {
    setSelectedUser(user);
    const name = user.full_name_bn?.trim() || user.full_name_en?.trim() || user.email;
    if (!displayName.trim()) setDisplayName(name);
  }

  async function createHost() {
    if (!selectedUser) {
      setError('Pick a user to list as host');
      return;
    }
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch('/live-streams/admin/hosts', {
        method: 'POST',
        body: JSON.stringify({
          user_id: selectedUser.id,
          display_name: displayName.trim(),
          bio: bio.trim() || undefined,
          is_active: isActive,
        }),
      });
      setSelectedUser(null);
      setDisplayName('');
      setBio('');
      setIsActive(true);
      setUserQuery('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create host');
    } finally {
      setBusy(false);
    }
  }

  function startEdit(row: LiveHostRow) {
    setEditingId(row.id);
    setEditDisplayName(row.display_name);
    setEditBio(row.bio ?? '');
    setEditActive(row.is_active);
  }

  async function saveEdit() {
    if (!editingId) return;
    if (!editDisplayName.trim()) {
      setError('Display name is required');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/live-streams/admin/hosts/${editingId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          display_name: editDisplayName.trim(),
          bio: editBio.trim() || null,
          is_active: editActive,
        }),
      });
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update host');
    } finally {
      setBusy(false);
    }
  }

  async function removeHost(id: string) {
    if (!confirm('Remove this host from the directory? Assigned classes keep their host_user_id.')) {
      return;
    }
    setBusy(true);
    setError('');
    try {
      await apiFetch(`/live-streams/admin/hosts/${id}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete host');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live hosts"
        description="Maintain the listed host directory. When scheduling a live class, pick a host from this list. Active hosts appear in the create/edit picker."
      />
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/live/admin">Back to live admin</Link>
        </Button>
      </div>

      {error ? <Alert variant="error">{error}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add listed host</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="host-user-search">User</Label>
            <Input
              id="host-user-search"
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              placeholder="Search name, email, or phone"
            />
            {selectedUser ? (
              <div className="rounded-lg border bg-slate-50 px-3 py-2 text-sm">
                Selected:{' '}
                <span className="font-semibold">
                  {selectedUser.full_name_bn?.trim() || selectedUser.full_name_en}
                </span>
                <span className="text-muted-foreground">
                  {' '}
                  · {selectedUser.email}
                  {selectedUser.phone ? ` · ${selectedUser.phone}` : ''}
                </span>
                <button
                  type="button"
                  className="ml-2 text-xs font-medium text-pink-700 underline"
                  onClick={() => setSelectedUser(null)}
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto rounded-lg border">
                {userResults.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-muted-foreground">No users found</p>
                ) : (
                  userResults.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="flex w-full items-start gap-2 border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                      onClick={() => pickUser(u)}
                    >
                      <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                      <span>
                        <span className="font-medium">
                          {u.full_name_bn?.trim() || u.full_name_en}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {u.email}
                          {u.phone ? ` · ${u.phone}` : ''}
                        </span>
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="host-display-name">Display name</Label>
            <Input
              id="host-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Shown on live class cards"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="host-active">Status</Label>
            <select
              id="host-active"
              value={isActive ? 'active' : 'inactive'}
              onChange={(e) => setIsActive(e.target.value === 'active')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="active">Active — appears in picker</option>
              <option value="inactive">Inactive — hidden from picker</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="host-bio">Bio (optional)</Label>
            <textarea
              id="host-bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Short intro for this host"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" onClick={() => void createHost()} disabled={busy}>
              <Plus className="mr-1 h-4 w-4" />
              {busy ? 'Saving…' : 'Add host'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Host directory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No listed hosts yet.</p>
          ) : (
            items.map((item) => (
              <div key={item.id} className="rounded-xl border p-3">
                {editingId === item.id ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Display name</Label>
                      <Input
                        value={editDisplayName}
                        onChange={(e) => setEditDisplayName(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Status</Label>
                      <select
                        value={editActive ? 'active' : 'inactive'}
                        onChange={(e) => setEditActive(e.target.value === 'active')}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                      </select>
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Bio</Label>
                      <textarea
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        rows={2}
                        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      />
                    </div>
                    <div className="flex gap-2 sm:col-span-2">
                      <Button type="button" size="sm" onClick={() => void saveEdit()} disabled={busy}>
                        Save
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-lg bg-pink-50 p-2 text-pink-700">
                      <UserRound className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-slate-900">{item.display_name}</div>
                      <div className="text-sm text-slate-500">
                        {item.user_name || item.user_email || item.user_id}
                        {item.user_email ? ` · ${item.user_email}` : ''}
                        {item.user_phone ? ` · ${item.user_phone}` : ''}
                      </div>
                      {item.bio ? <p className="mt-1 text-sm text-slate-600">{item.bio}</p> : null}
                      <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                        {item.is_active ? 'Active' : 'Inactive'}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => startEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => void removeHost(item.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Remove
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
