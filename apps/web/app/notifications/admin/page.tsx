'use client';

import { useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import type { AdminNotificationRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { UserPicker } from '@/components/users/user-picker';

export default function NotificationsAdminPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetType, setTargetType] = useState<'all' | 'specific'>('all');
  const [targetUserIds, setTargetUserIds] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [history, setHistory] = useState<AdminNotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: AdminNotificationRecord[] }>('/admin-notifications');
      setHistory(res.data);
    } catch {
      // history load failure isn't fatal to the send form
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function handleSend() {
    setError('');
    setSuccess('');
    if (!title.trim() || !message.trim()) {
      setError('Title and message are required');
      return;
    }
    if (targetType === 'specific' && targetUserIds.length === 0) {
      setError('Select at least one user');
      return;
    }
    setSending(true);
    try {
      const res = await apiFetch<{ data: AdminNotificationRecord }>('/admin-notifications', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          target_type: targetType,
          target_user_ids: targetType === 'specific' ? targetUserIds : undefined,
        }),
      });
      setSuccess(
        `Sent to ${res.data.recipient_count} user${res.data.recipient_count === 1 ? '' : 's'} ` +
          `(${res.data.push_sent_count} push delivered, ${res.data.push_failed_count} failed)`,
      );
      setTitle('');
      setMessage('');
      setTargetType('all');
      setTargetUserIds([]);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send notification');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Send a broadcast or targeted notification to app users, with push delivery on Android."
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Send notification</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <Alert variant="error">{error}</Alert>}
          {success && <Alert variant="success">{success}</Alert>}

          <div className="space-y-1.5">
            <Label htmlFor="notif-title">Title</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. New questions added"
              maxLength={120}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notif-message">Message</Label>
            <textarea
              id="notif-message"
              className="ibas-textarea"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Notification body..."
              maxLength={2000}
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Target</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={targetType === 'all'}
                  onChange={() => setTargetType('all')}
                />
                All users
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={targetType === 'specific'}
                  onChange={() => setTargetType('specific')}
                />
                Specific users
              </label>
            </div>
          </div>

          {targetType === 'specific' && (
            <UserPicker selectedIds={targetUserIds} onChange={setTargetUserIds} />
          )}

          <Button type="button" disabled={sending} onClick={() => void handleSend()}>
            <Send className="h-4 w-4" />
            {sending ? 'Sending...' : 'Send notification'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">History</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted">Loading...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted">No notifications sent yet.</p>
          ) : (
            <div className="space-y-2">
              {history.map((n) => (
                <div key={n.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{n.title}</span>
                    <Badge variant="secondary">
                      {n.target_type === 'all' ? 'All users' : `${n.target_user_ids?.length ?? 0} users`}
                    </Badge>
                  </div>
                  <p className="mt-1 text-muted">{n.message}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    <span>{new Date(n.sent_at).toLocaleString()}</span>
                    <span>{n.recipient_count} recipients</span>
                    <span>{n.push_sent_count} push delivered</span>
                    {n.push_failed_count > 0 && <span>{n.push_failed_count} push failed</span>}
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
