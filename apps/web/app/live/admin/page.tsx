'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Video, Pencil, Trash2, Radio } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import {
  MarkupInstructionsButton,
  MarkupInstructionsModal,
} from '@/components/shared/markup-instructions-modal';

interface LiveRow {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: string;
  invite_count?: number;
  host_name?: string;
  access_type?: 'free' | 'paid';
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function openLiveRoom(sessionId: string) {
  window.open(`/live-room/${sessionId}`, '_blank', 'noopener,noreferrer');
}

export default function LiveStreamAdminPage() {
  const [items, setItems] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [accessType, setAccessType] = useState<'free' | 'paid'>('free');
  const [creating, setCreating] = useState(false);
  const [showMarkupHelp, setShowMarkupHelp] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<{ data: LiveRow[] }>('/live-streams/admin?limit=100');
      setItems(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function createSession() {
    setError('');
    if (!topic.trim() || !scheduledAt) {
      setError('Topic and date & time are required');
      return;
    }
    setCreating(true);
    try {
      const res = await apiFetch<{ data: LiveRow }>('/live-streams', {
        method: 'POST',
        body: JSON.stringify({
          topic: topic.trim(),
          details: details.trim() || undefined,
          scheduled_at: new Date(scheduledAt).toISOString(),
          access_type: accessType,
        }),
      });
      setTopic('');
      setDetails('');
      setScheduledAt('');
      await load();
      window.location.href = `/live/admin/${res.data.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setCreating(false);
    }
  }

  async function deleteSession(itemId: string) {
    if (!confirm('Delete this live class?')) return;
    setError('');
    try {
      await apiFetch(`/live-streams/${itemId}`, { method: 'DELETE' });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live class"
        description="Schedule sessions and invite users here. Open Control room in a new tab for mic, screen share, messages, guests, pause, and end."
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      <MarkupInstructionsModal open={showMarkupHelp} onClose={() => setShowMarkupHelp(false)} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">New live session</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="live-topic">Topic</Label>
            <Input
              id="live-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. GFR Chapter 5 revision"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="live-when">Date &amp; time</Label>
            <Input
              id="live-when"
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="live-access">Access</Label>
            <select
              id="live-access"
              value={accessType}
              onChange={(e) => setAccessType(e.target.value === 'paid' ? 'paid' : 'free')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="free">Free — all invited users</option>
              <option value="paid">Paid — paid users only</option>
            </select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="live-details">Details</Label>
              <MarkupInstructionsButton onClick={() => setShowMarkupHelp(true)} />
            </div>
            <textarea
              id="live-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={4}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Use markup markers — see Markup guide"
            />
          </div>
          <div className="sm:col-span-2">
            <Button onClick={() => void createSession()} disabled={creating}>
              <Plus className="mr-1 h-4 w-4" />
              {creating ? 'Creating…' : 'Create session'}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Scheduled sessions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground">No live sessions yet.</p>
          ) : (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl border p-3"
              >
                <Link
                  href={`/live/admin/${item.id}`}
                  className="mt-0.5 rounded-lg bg-pink-50 p-2 text-pink-700 hover:bg-pink-100"
                >
                  <Video className="h-4 w-4" />
                </Link>
                <Link href={`/live/admin/${item.id}`} className="min-w-0 flex-1 hover:opacity-90">
                  <div className="font-semibold text-slate-900">{item.topic}</div>
                  <div className="text-sm text-slate-500">{formatWhen(item.scheduled_at)}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {item.status}
                    {item.access_type === 'paid' ? ' · Paid class' : ' · Free class'}
                    {item.host_name ? ` · Host: ${item.host_name}` : ''}
                    {typeof item.invite_count === 'number' ? ` · ${item.invite_count} invited` : ''}
                  </div>
                </Link>
                <div className="flex shrink-0 gap-1">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => openLiveRoom(item.id)}
                  >
                    <Radio className="h-3.5 w-3.5" />
                    Control room
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/live/admin/${item.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void deleteSession(item.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
