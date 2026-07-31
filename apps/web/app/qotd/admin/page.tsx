'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Trash2 } from 'lucide-react';
import type { QotdEntrySummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

/** Question of the Day gets its own cool teal accent, distinct from the app's default blue. */
const qotdButton = 'bg-teal-600 text-white hover:bg-teal-700';
const qotdCard = 'border-teal-100';

export default function QotdAdminPage() {
  const [entries, setEntries] = useState<QotdEntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [showPastDays, setShowPastDays] = useState(7);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [entriesRes, settingsRes] = await Promise.all([
        apiFetch<{ data: QotdEntrySummary[] }>('/qotd/admin/entries?limit=100'),
        apiFetch<{ data: { show_past_days: number } }>('/qotd/settings'),
      ]);
      setEntries(entriesRes.data);
      setShowPastDays(settingsRes.data.show_past_days);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function saveSettings() {
    setSavingSettings(true);
    setSettingsMessage('');
    try {
      await apiFetch('/qotd/settings', {
        method: 'PUT',
        body: JSON.stringify({ show_past_days: showPastDays }),
      });
      setSettingsMessage('Saved');
    } catch (err) {
      setSettingsMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingSettings(false);
    }
  }

  async function removeEntry(id: string) {
    if (!confirm('Remove this Question of the Day entry?')) return;
    try {
      await apiFetch(`/qotd/entries/${id}`, { method: 'DELETE' });
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
    }
  }

  async function updatePublishTime(id: string, publishTime: string) {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, publish_time: publishTime } : e)));
    try {
      await apiFetch(`/qotd/entries/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ publish_time: publishTime }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update publish time');
      await load();
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question of the Day"
        description="Pick syllabus-linked questions for a subject and date; users browse them from that date backward."
        action={
          <Link href="/qotd/admin/new">
            <Button type="button" size="sm" className={qotdButton}>
              <Plus className="h-4 w-4" />
              New entry
            </Button>
          </Link>
        }
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card className={qotdCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
            Visibility window
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="show-past-days">Show past days (mobile)</Label>
            <Input
              id="show-past-days"
              type="number"
              min={0}
              max={365}
              value={showPastDays}
              onChange={(e) => setShowPastDays(Number(e.target.value))}
              className="w-32"
            />
          </div>
          <Button
            type="button"
            size="sm"
            className={qotdButton}
            disabled={savingSettings}
            onClick={() => void saveSettings()}
          >
            {savingSettings ? 'Saving...' : 'Save'}
          </Button>
          {settingsMessage && <span className="text-sm text-muted">{settingsMessage}</span>}
        </CardContent>
      </Card>

      <Card className={qotdCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
            Entries
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted">No entries yet.</p>
          ) : (
            <div className="space-y-2">
              {entries.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-teal-100 bg-teal-50/40 p-3 text-sm"
                >
                  <div>
                    <span className="font-medium text-teal-900">{e.date}</span>
                    <span className="mx-2 text-muted">·</span>
                    <span>{e.subject_name}</span>
                    <span className="ml-2 text-xs text-muted">
                      ({e.question_count} question{e.question_count === 1 ? '' : 's'})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <Label htmlFor={`publish-time-${e.id}`} className="text-xs text-muted">
                        Publish
                      </Label>
                      <Input
                        id={`publish-time-${e.id}`}
                        type="time"
                        value={e.publish_time}
                        onChange={(ev) => void updatePublishTime(e.id, ev.target.value)}
                        className="h-8 w-28 text-xs"
                      />
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0 px-2"
                      onClick={() => void removeEntry(e.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
