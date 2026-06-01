'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { DataTable } from '@/components/shared/data-table';
import { Badge } from '@/components/ui/badge';

interface UserRow {
  id: string;
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone: string;
  user_type: string;
  status: string;
}

function statusVariant(status: string): 'success' | 'warning' | 'destructive' | 'secondary' {
  if (status === 'active') return 'success';
  if (status === 'pending_verify') return 'warning';
  if (status === 'suspended') return 'destructive';
  return 'secondary';
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{ data: UserRow[] }>('/users?limit=50')
      .then((res) => setUsers(res.data))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Manage system users, workflow roles, and module access."
        action={
          <Button asChild>
            <Link href="/admin/users/new">
              <Plus className="h-4 w-4" />
              Add user
            </Link>
          </Button>
        }
      />

      <Card>
        <CardHeader className="border-b border-border pb-4">
          <CardTitle className="text-lg">All users</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          <DataTable
            className="border-0 shadow-none rounded-none"
            loading={loading}
            data={users}
            emptyTitle="No users yet"
            emptyDescription="Create the first user to get started."
            columns={[
              {
                key: 'name',
                header: 'Name',
                cell: (u) => (
                  <div>
                    <div className="font-medium text-foreground">{u.full_name_en}</div>
                    {u.full_name_bn && <div className="text-xs text-muted">{u.full_name_bn}</div>}
                  </div>
                ),
              },
              { key: 'email', header: 'Email', cell: (u) => u.email },
              { key: 'phone', header: 'Phone', className: 'hidden md:table-cell', cell: (u) => u.phone },
              {
                key: 'type',
                header: 'Type',
                cell: (u) => <Badge variant="outline">{u.user_type}</Badge>,
              },
              {
                key: 'status',
                header: 'Status',
                cell: (u) => <Badge variant={statusVariant(u.status)}>{u.status}</Badge>,
              },
              {
                key: 'actions',
                header: '',
                className: 'text-right',
                cell: (u) => (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/admin/users/${u.id}`}>Edit</Link>
                  </Button>
                ),
              },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
