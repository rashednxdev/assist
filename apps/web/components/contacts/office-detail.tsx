'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Building2, ChevronRight, Globe, Info, Mail, MapPin, Network, Phone, Printer, Smartphone, Users } from 'lucide-react';
import type { ContactOfficeDetail, ContactPhone } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useContactAccess } from '@/components/contacts/contact-access';
import { CopyButton, downloadVCard, FavoriteStar, mapsUrl, PhoneLine, PrintButton, SaveContactButton } from '@/components/contacts/contact-bits';
import { OfficeList } from '@/components/contacts/office-list';
import { EmployeeDirectory } from '@/components/contacts/employee-directory';

type View = 'about' | 'sub' | 'employees';

export function OfficeDetail({ id }: { id: string }) {
  const { access } = useContactAccess();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get('view');
  const view: View = raw === 'sub' || raw === 'employees' ? raw : 'about';

  const [office, setOffice] = useState<ContactOfficeDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setOffice(null);
    setError('');
    apiFetch<{ data: ContactOfficeDetail }>(`/contacts/offices/${id}`)
      .then((r) => setOffice(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load office'));
  }, [id]);

  function setView(v: View) {
    router.replace(v === 'about' ? pathname : `${pathname}?view=${v}`, { scroll: false });
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/contacts" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary">
          <ArrowLeft className="h-4 w-4" /> Contacts
        </Link>
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }
  if (!office) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-56 rounded-3xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const phones = [
    office.telephone && { label: 'Telephone', phone: office.telephone, icon: Phone, mobile: false },
    office.mobile && { label: 'Mobile', phone: office.mobile, icon: Smartphone, mobile: true },
    office.pabx && { label: 'PABX', phone: office.pabx, icon: Phone, mobile: false },
    office.fax && { label: 'Fax', phone: office.fax, icon: Printer, mobile: false },
  ].filter(Boolean) as Array<{ label: string; phone: ContactPhone; icon: typeof Phone; mobile: boolean }>;
  const location = [office.address, office.thana_name, office.district_name].filter(Boolean).join(', ');
  const selfEmployees = office.employee_count;
  const subEmployees = office.employee_total - office.employee_count;

  const views: Array<{ id: View; label: string; icon: typeof Info; count?: number; disabled?: boolean }> = [
    { id: 'about', label: 'Office info', icon: Info },
    { id: 'sub', label: 'Sub-offices', icon: Network, count: office.sub_office_count, disabled: office.sub_office_count === 0 },
    { id: 'employees', label: 'Employees', icon: Users, count: office.employee_total },
  ];

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-1 text-sm text-muted print:hidden" aria-label="Breadcrumb">
        <Link href="/contacts" className="font-medium hover:text-primary">
          Contacts
        </Link>
        {office.breadcrumb.map((b) => (
          <span key={b.id} className="flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5" />
            <Link href={`/contacts/office/${b.id}`} className="hover:text-primary">
              {b.short_name || b.name}
            </Link>
          </span>
        ))}
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-foreground">{office.short_name || office.name}</span>
      </nav>

      <header className={cn('overflow-hidden rounded-3xl border bg-surface shadow-sm', office.is_my_office ? 'border-primary/50' : 'border-border')}>
        <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-sky-700 p-6 text-white">
          <div className="flex items-start gap-4">
            <span className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 sm:flex">
              <Building2 className="h-7 w-7" />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                {office.office_type && <span className="rounded-md bg-white/20 px-2 py-0.5 font-semibold">{office.office_type.name}</span>}
                {office.office_code && <span className="rounded-md bg-white/10 px-2 py-0.5 font-mono">Code {office.office_code}</span>}
                {office.is_my_office && <span className="rounded-md bg-white px-2 py-0.5 font-semibold text-teal-800">Your office</span>}
              </div>
              <h1 className="text-2xl font-bold leading-tight tracking-tight">
                {office.name}
                {office.short_name && office.short_name !== office.name && <span className="ml-2 text-lg font-medium text-white/80">({office.short_name})</span>}
              </h1>
              {office.name_bn && <p className="text-white/85">{office.name_bn}</p>}
              {office.parent_path && <p className="text-sm text-white/75">Under {office.parent_path}</p>}
            </div>
            <span className="rounded-lg bg-white/90">
              <FavoriteStar type="office" id={office.id} value={office.is_favorite} />
            </span>
          </div>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_1fr]">
          <div className="space-y-3">
            {phones.length > 0 ? (
              phones.map((p) => <PhoneLine key={p.label} label={p.label} phone={p.phone} icon={p.icon} mobile={p.mobile} />)
            ) : (
              <p className="text-sm text-muted">No phone numbers listed.</p>
            )}
          </div>
          <div className="space-y-3 text-sm">
            {office.email && (
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-muted" />
                <a href={`mailto:${office.email}`} className="min-w-0 flex-1 truncate font-medium hover:text-primary">
                  {office.email}
                </a>
                <CopyButton text={office.email} title="Copy email" />
              </div>
            )}
            {office.web_address && (
              <a href={office.web_address} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-primary">
                <Globe className="h-4 w-4 shrink-0 text-muted" />
                <span className="truncate">{office.web_address.replace(/^https?:\/\//, '')}</span>
              </a>
            )}
            {location && (
              <a href={mapsUrl(office)} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 hover:text-primary">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                <span>{location}</span>
              </a>
            )}
            <div className="flex flex-wrap gap-2 pt-1 print:hidden">
              <SaveContactButton
                onSave={() =>
                  downloadVCard({
                    name: office.name,
                    org: office.name,
                    phones: [
                      office.telephone?.dial && { type: 'WORK', value: office.telephone.dial },
                      office.mobile?.dial && { type: 'CELL', value: office.mobile.dial },
                      office.pabx?.dial && { type: 'WORK', value: office.pabx.dial },
                      office.fax?.dial && { type: 'FAX', value: office.fax.dial },
                    ].filter(Boolean) as Array<{ type: string; value: string }>,
                    email: office.email,
                    url: office.web_address,
                    address: location || undefined,
                  })
                }
              />
              <PrintButton />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 border-t border-border bg-slate-50/60 p-1.5 print:hidden">
          {views.map((v) => (
            <button
              key={v.id}
              type="button"
              disabled={v.disabled}
              onClick={() => setView(v.id)}
              className={cn(
                'flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
                view === v.id ? 'bg-primary text-white shadow-sm' : 'text-foreground hover:bg-white',
              )}
            >
              <v.icon className="h-4 w-4" />
              <span className="hidden sm:inline">{v.label}</span>
              {v.count !== undefined && <span className={cn('rounded-full px-1.5 text-xs', view === v.id ? 'bg-white/25' : 'bg-slate-200 text-slate-700')}>{v.count}</span>}
            </button>
          ))}
        </div>
      </header>

      {view === 'about' && (
        <div className="grid gap-4 md:grid-cols-3">
          <button type="button" onClick={() => setView('employees')} className="rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition hover:border-primary/40 hover:shadow-md">
            <Users className="h-6 w-6 text-primary" />
            <p className="mt-3 text-2xl font-bold tabular-nums">{selfEmployees}</p>
            <p className="text-sm text-muted">People in this office</p>
          </button>
          <button
            type="button"
            disabled={office.sub_office_count === 0}
            onClick={() => setView('sub')}
            className="rounded-2xl border border-border bg-surface p-5 text-left shadow-sm transition enabled:hover:border-primary/40 enabled:hover:shadow-md disabled:opacity-60"
          >
            <Network className="h-6 w-6 text-primary" />
            <p className="mt-3 text-2xl font-bold tabular-nums">{office.sub_office_count}</p>
            <p className="text-sm text-muted">Direct sub-offices</p>
          </button>
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <Building2 className="h-6 w-6 text-primary" />
            <p className="mt-3 text-2xl font-bold tabular-nums">{subEmployees}</p>
            <p className="text-sm text-muted">People in sub-offices</p>
          </div>
          {office.description && (
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm md:col-span-3">
              <p className="mb-2 text-sm font-semibold">About</p>
              <p className="whitespace-pre-line text-sm text-muted">{office.description}</p>
            </div>
          )}
          {!access.can_dial && (
            <p className="text-xs text-muted md:col-span-3">Numbers are partly hidden. Tap a locked button to see how to unlock calling.</p>
          )}
        </div>
      )}

      {view === 'sub' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Sub-offices of {office.short_name || office.name}</h2>
          <OfficeList parentId={office.id} emptyTitle="No sub-offices" />
        </section>
      )}

      {view === 'employees' && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Employees of {office.short_name || office.name}</h2>
          <EmployeeDirectory key={office.id} officeId={office.id} />
        </section>
      )}
    </div>
  );
}
