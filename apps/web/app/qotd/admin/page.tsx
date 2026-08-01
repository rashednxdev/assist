'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QotdDateSummary } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

/** Questions of the Day gets its own cool emerald accent, distinct from the app's default blue. */
const qotdButton = 'bg-emerald-600 text-white hover:bg-emerald-700';
const qotdCard = 'border-emerald-100';

export default function QotdAdminPage() {
  const router = useRouter();
  const [dates, setDates] = useState<QotdDateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [newDate, setNewDate] = useState('');

  const [showPastDays, setShowPastDays] = useState(7);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');

  async function load() {
    setLoading(true);
    try {
      const [datesRes, settingsRes] = await Promise.all([
        apiFetch<{ data: QotdDateSummary[] }>('/qotd/admin/dates'),
        apiFetch<{ data: { show_past_days: number } }>('/qotd/settings'),
      ]);
      setDates(datesRes.data);
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

  function openDate(date: string) {
    if (!date) return;
    router.push(`/qotd/admin/${date}`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Questions of the Day"
        description="Pick a date, then add one or more subjects' questions to it. Users browse by date first, seeing every subject's questions for that day."
      />

      {error && <Alert variant="error">{error}</Alert>}

      <Card className={qotdCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Open or start a date
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="new-date">Date</Label>
            <Input id="new-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </div>
          <Button type="button" className={qotdButton} disabled={!newDate} onClick={() => openDate(newDate)}>
            Open date
          </Button>
        </CardContent>
      </Card>

      <Card className={qotdCard}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
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
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            Dates
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : dates.length === 0 ? (
            <p className="text-sm text-muted">No dates yet — pick a date above to get started.</p>
          ) : (
            <div className="space-y-2">
              {dates.map((d) => (
                <button
                  key={d.date}
                  type="button"
                  onClick={() => openDate(d.date)}
                  className="flex w-full items-center justify-between gap-2 rounded-md border border-emerald-100 bg-emerald-50/40 p-3 text-left text-sm hover:bg-emerald-50"
                >
                  <span className="font-medium text-emerald-900">{d.date}</span>
                  <span className="text-xs text-muted">
                    {d.subject_count} subject{d.subject_count === 1 ? '' : 's'} · {d.question_count} question
                    {d.question_count === 1 ? '' : 's'}
                  </span>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
