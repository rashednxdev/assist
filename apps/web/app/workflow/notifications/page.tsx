'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert } from '@/components/ui/alert';

interface NotificationItem {
  id: string;
  run_id: string;
  type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  function load() {
    setLoading(true);
    apiFetch<{ data: NotificationItem[] }>('/notifications')
      .then((r) => setItems(r.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  async function markRead(id: string) {
    await apiFetch(`/notifications/${id}/read`, { method: 'PATCH' });
    load();
  }

  async function markAllRead() {
    await apiFetch('/notifications/read-all', { method: 'PATCH' });
    setMessage('All notifications marked as read');
    load();
  }

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Handoffs and alerts from workflow runs."
        action={
          unread > 0 ? (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4" />
              Mark all read
            </Button>
          ) : undefined
        }
      />

      {message && <Alert variant="success">{message}</Alert>}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bell className="h-5 w-5 text-primary" />
            Inbox
            {unread > 0 && <Badge variant="default">{unread} new</Badge>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : items.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No notifications" description="Handoff messages will appear here when a step is submitted." />
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((n) => (
                <li
                  key={n.id}
                  className={`flex flex-col gap-2 px-4 py-4 sm:flex-row sm:items-start sm:justify-between ${
                    !n.is_read ? 'bg-primary-muted/40' : ''
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">{n.title}</span>
                      <Badge variant="outline">{n.type}</Badge>
                      {!n.is_read && <Badge variant="default">New</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-muted">{n.message}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(n.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/workflow/guide?run=${n.run_id}`}>Open run</Link>
                    </Button>
                    {!n.is_read && (
                      <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                        Mark read
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
