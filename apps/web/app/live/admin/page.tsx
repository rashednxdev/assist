'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Video } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface LiveRow {
  id: string;
  topic: string;
  details?: string;
  scheduled_at: string;
  status: string;
  invite_count?: number;
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

export default function LiveStreamAdminPage() {
  const [items, setItems] = useState<LiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [topic, setTopic] = useState('');
  const [details, setDetails] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [creating, setCreating] = useState(false);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live class"
        description="Schedule one-to-many live sessions. Invite users so only allowed people can join the embedded Agora stream."
      />

      {error ? <Alert variant="error">{error}</Alert> : null}

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
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="live-details">Details</Label>
            <textarea
              id="live-details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="What will you cover? Any prep for students?"
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
              <Link
                key={item.id}
                href={`/live/admin/${item.id}`}
                className="flex items-start gap-3 rounded-xl border p-3 transition hover:bg-slate-50"
              >
                <div className="mt-0.5 rounded-lg bg-pink-50 p-2 text-pink-700">
                  <Video className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-slate-900">{item.topic}</div>
                  <div className="text-sm text-slate-500">{formatWhen(item.scheduled_at)}</div>
                  <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                    {item.status}
                    {typeof item.invite_count === 'number' ? ` · ${item.invite_count} invited` : ''}
                  </div>
                </div>
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
