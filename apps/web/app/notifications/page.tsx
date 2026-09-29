'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import type { NotificationRecipientRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { formatDateTimeDdMmYyyy } from '@/lib/date-display';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface MineResponse {
  data: NotificationRecipientRecord[];
  meta: { total: number; unread_count: number };
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRecipientRecord[]>([]);
  const [unread, setUnread] = useState(0);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch<MineResponse>(
        `/admin-notifications/mine?limit=50${unreadOnly ? '&unread_only=true' : ''}`,
      );
      setItems(res.data);
      setUnread(res.meta.unread_count);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [unreadOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  async function open(item: NotificationRecipientRecord) {
    setExpanded((cur) => (cur === item.id ? null : item.id));
    if (item.is_read) return;
    setItems((cur) => cur.map((n) => (n.id === item.id ? { ...n, is_read: true } : n)));
    setUnread((n) => Math.max(0, n - 1));
    await apiFetch(`/admin-notifications/mine/${item.id}/read`, { method: 'PATCH' }).catch(() => undefined);
  }

  async function markAll() {
    await apiFetch('/admin-notifications/mine/read-all', { method: 'POST' }).catch(() => undefined);
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Notifications"
        description="Announcements and messages from the ProAssist team."
        backHref="/dashboard"
        action={
          unread > 0 ? (
            <Button size="sm" variant="outline" onClick={() => void markAll()}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : null
        }
      />

      <div className="flex gap-2">
        <Button size="sm" variant={unreadOnly ? 'outline' : 'default'} onClick={() => setUnreadOnly(false)}>
          All
        </Button>
        <Button size="sm" variant={unreadOnly ? 'default' : 'outline'} onClick={() => setUnreadOnly(true)}>
          Unread {unread > 0 ? `(${unread})` : ''}
        </Button>
      </div>

      {error && <Alert variant="error">{error}</Alert>}

      {loading ? (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={unreadOnly ? 'No unread notifications' : 'No notifications yet'}
          description="You will see announcements here when the admin sends them."
          action={
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">Back to home</Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => void open(n)}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors',
                n.is_read ? 'border-border bg-surface' : 'border-primary/30 bg-primary-muted/40',
              )}
            >
              <div
                className={cn(
                  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                  n.is_read ? 'bg-slate-100 text-slate-500' : 'bg-primary text-white',
                )}
              >
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={cn('truncate', n.is_read ? 'font-medium' : 'font-semibold')}>{n.title}</p>
                  {!n.is_read && <Badge>New</Badge>}
                </div>
                <p
                  className={cn(
                    'mt-1 whitespace-pre-line text-sm text-muted',
                    expanded !== n.id && 'line-clamp-2',
                  )}
                >
                  {n.message}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted">
                  <span>{formatDateTimeDdMmYyyy(n.created_at)}</span>
                  {n.source === 'schedule' && <Badge variant="outline">Schedule</Badge>}
                  {n.source === 'billing' && <Badge variant="outline">Payment</Badge>}
                  {n.source === 'community' && <Badge variant="outline">Community</Badge>}
                  {n.link?.startsWith('/') && (
                    <Link href={n.link} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
                      Open
                    </Link>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
