'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ContactDepartment } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ContactsGate } from '@/components/contacts/contact-access';
import { OfficeCard } from '@/components/contacts/contact-bits';

function Departments() {
  const [items, setItems] = useState<ContactDepartment[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    apiFetch<{ data: ContactDepartment[] }>('/contacts/departments')
      .then((r) => setItems(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load departments'));
  }, []);

  const visible = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!items || !term) return items ?? [];
    return items.filter((d) => [d.name, d.name_bn, d.short_name, d.office_code].some((t) => t?.toLowerCase().includes(term)));
  }, [items, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Departments"
        description="Choose a department, then open any of its offices to see their contacts and employees."
        backHref="/contacts"
        backLabel="Contacts"
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search departments" className="h-11 pl-9" />
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      {!items ? (
        !error && (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-56 rounded-2xl" />
            ))}
          </div>
        )
      ) : visible.length === 0 ? (
        <EmptyState title="No departments found" description={query ? 'Try a different name or short name.' : 'Departments appear once an administrator adds top-level offices.'} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((d) => (
            <div key={d.id} className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 px-1 text-xs text-muted">
                {d.is_my_department && <Badge variant="success">Your department</Badge>}
                <span>
                  {d.office_count} {d.office_count === 1 ? 'office' : 'offices'} · {d.employee_total} {d.employee_total === 1 ? 'employee' : 'employees'}
                </span>
              </div>
              <OfficeCard o={d} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ContactDepartmentsPage() {
  return (
    <ContactsGate>
      <Departments />
    </ContactsGate>
  );
}
