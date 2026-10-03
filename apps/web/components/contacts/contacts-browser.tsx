'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, BookUser, Building2, Crown, EyeOff, GraduationCap, Home, Layers, Network, Search, Star, Users, X } from 'lucide-react';
import type { ContactFavorites, ContactOverview } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { saveContactConsent, useContactAccess } from '@/components/contacts/contact-access';
import { Button } from '@/components/ui/button';
import { EmployeeCard, OfficeCard } from '@/components/contacts/contact-bits';
import { OfficeList } from '@/components/contacts/office-list';
import { Chip, EmployeeDirectory } from '@/components/contacts/employee-directory';
import { DirectoryPrivacy } from '@/components/contacts/directory-privacy';
import { Batchmates } from '@/components/contacts/batchmates';

type Tab = 'offices' | 'employees' | 'batchmates' | 'favorites';

const TABS: Array<{ id: Tab; label: string; icon: typeof Building2 }> = [
  { id: 'offices', label: 'Offices', icon: Building2 },
  { id: 'employees', label: 'Employees', icon: Users },
  { id: 'batchmates', label: 'Batchmates', icon: GraduationCap },
  { id: 'favorites', label: 'Favourites', icon: Star },
];

function Stat({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: number | string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2 backdrop-blur">
      <Icon className="h-5 w-5 text-white/80" />
      <div>
        <p className="text-lg font-bold leading-none text-white tabular-nums">{value}</p>
        <p className="text-[11px] text-white/75">{label}</p>
      </div>
    </div>
  );
}

function UnpaidBanner() {
  const { access, requestUpgrade } = useContactAccess();
  if (access.can_dial) return null;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-warning-light p-4 sm:flex-row sm:items-center">
      <Crown className="h-6 w-6 shrink-0 text-amber-600" />
      <div className="flex-1 text-sm text-amber-900">
        <p className="font-semibold">Browsing is free. Calling is part of any package.</p>
        <p className="opacity-90">Phone numbers are partly hidden. Buy a package to see full numbers, call with one tap, WhatsApp colleagues and save contacts to your phone.</p>
      </div>
      <button type="button" onClick={requestUpgrade} className="shrink-0 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700">
        Unlock calling
      </button>
    </div>
  );
}

function SharingSection() {
  const { access, setAccess } = useContactAccess();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function change(accept: boolean) {
    if (!accept && !confirm('Stop sharing your details? You will be removed from the directory and need to agree again to use Contacts.')) return;
    setBusy(true);
    setError('');
    try {
      setAccess(await saveContactConsent(accept));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 space-y-2 border-t border-border pt-4">
      <p className="text-sm font-semibold">Sharing my details</p>
      {access.consented ? (
        <>
          <p className="text-xs text-muted">
            You are listed in the directory
            {access.consented_at ? ` (agreed on ${new Date(access.consented_at).toLocaleDateString('en-GB')})` : ''}.
          </p>
          <button type="button" disabled={busy} onClick={() => void change(false)} className="text-sm font-medium text-destructive hover:underline disabled:opacity-50">
            Stop sharing my details
          </button>
        </>
      ) : (
        <>
          <p className="text-xs text-muted">You are not listed in the directory. Adding your details is optional.</p>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void change(true)}>
            Share my details with Contacts users
          </Button>
        </>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function PrivacyDialog({ onClose }: { onClose: () => void }) {
  const { access, setAccess } = useContactAccess();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-muted hover:bg-slate-100" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <DirectoryPrivacy initial={access.privacy} onChange={(privacy) => setAccess({ ...access, privacy })} />
        <p className="mt-4 text-xs text-muted">
          While you share your details, your name, designation and office are listed so colleagues can find you. Change them in{' '}
          <Link href="/settings/profile" className="font-medium text-primary hover:underline">
            profile settings
          </Link>
          .
        </p>
        <SharingSection />
      </div>
    </div>
  );
}

function FavoritesTab() {
  const [data, setData] = useState<ContactFavorites | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    apiFetch<{ data: ContactFavorites }>('/contacts/favorites')
      .then((r) => setData(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load favourites'));
  }, []);
  useEffect(load, [load]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!data) return <Skeleton className="h-48 rounded-2xl" />;
  if (!data.offices.length && !data.employees.length) {
    return <EmptyState title="No favourites yet" description="Tap the star on any office or person to keep them here for quick access." />;
  }
  const drop = (kind: 'offices' | 'employees', id: string) => (on: boolean) => {
    if (on) return;
    setData((cur) => (cur ? { ...cur, [kind]: cur[kind].filter((x) => x.id !== id) } : cur));
  };
  return (
    <div className="space-y-8">
      {data.offices.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Offices ({data.offices.length})</h2>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {data.offices.map((o) => (
              <OfficeCard key={o.id} o={o} onFavorite={drop('offices', o.id)} />
            ))}
          </div>
        </section>
      )}
      {data.employees.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">People ({data.employees.length})</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.employees.map((e) => (
              <EmployeeCard key={e.id} e={e} onFavorite={drop('employees', e.id)} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function OfficesTab({ overview, typeId, setTypeId }: { overview: ContactOverview; typeId: string; setTypeId: (id: string) => void }) {
  const [query, setQuery] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const activeGroup = overview.groups.find((g) => g.type.id === typeId);

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search offices by name, short name, code, email or address" className="h-11 pl-9" />
      </div>

      {overview.groups.length > 0 && (
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          <Chip active={!typeId} onClick={() => setTypeId('')} label="All types" count={overview.totals.offices} />
          {overview.groups.map((g) => (
            <Chip key={g.type.id} active={typeId === g.type.id} onClick={() => setTypeId(g.type.id)} label={g.type.short_name || g.type.name} title={g.type.name} count={g.office_count} />
          ))}
        </div>
      )}

      {q || typeId ? (
        <>
          {activeGroup && (
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <Layers className="h-5 w-5 text-primary" /> {activeGroup.type.name}
            </h2>
          )}
          <OfficeList typeId={typeId || undefined} q={q || undefined} emptyText={q ? 'Try a different name, short name or office code.' : undefined} />
        </>
      ) : overview.groups.length === 0 ? (
        <EmptyState title="No offices yet" description="Offices appear here once an administrator adds them." />
      ) : (
        <div className="space-y-10">
          {overview.groups.map((g) => (
            <section key={g.type.id} className="space-y-3">
              <div className="flex items-end justify-between gap-3 border-b border-border pb-2">
                <div>
                  <h2 className="text-lg font-semibold">{g.type.name}</h2>
                  <p className="text-xs text-muted">
                    {g.office_count} {g.office_count === 1 ? 'office' : 'offices'}
                  </p>
                </div>
                {g.office_count > g.offices.length && (
                  <button type="button" onClick={() => setTypeId(g.type.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-dark">
                    View all ({g.office_count}) <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {g.offices.map((o) => (
                  <OfficeCard key={o.id} o={o} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export function ContactsBrowser() {
  const { access } = useContactAccess();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'offices') as Tab;
  const typeId = params.get('type') ?? '';

  const [overview, setOverview] = useState<ContactOverview | null>(null);
  const [error, setError] = useState('');
  const [privacyOpen, setPrivacyOpen] = useState(false);

  useEffect(() => {
    apiFetch<{ data: ContactOverview }>('/contacts/overview')
      .then((r) => setOverview(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load contacts'));
  }, []);

  function update(next: Record<string, string>) {
    const p = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    const s = p.toString();
    router.replace(s ? `${pathname}?${s}` : pathname, { scroll: false });
  }

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-700 via-teal-600 to-sky-700 p-6 text-white shadow-lg sm:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-40 w-40 rounded-full bg-white/5" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
              <BookUser className="h-3.5 w-3.5" /> Contacts directory
            </p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              {overview?.department ? overview.department.name : 'Find any office or colleague'}
            </h1>
            <p className="max-w-xl text-sm text-white/85">
              {overview?.department
                ? 'Offices and employees of your department. Open another department to see theirs.'
                : 'Every department: browse offices by type, open sub-offices and staff lists, and reach people by designation.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/contacts/departments" className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25">
              <Network className="h-4 w-4" /> Other departments
            </Link>
            {access.my_office_id && (
              <Link href={`/contacts/office/${access.my_office_id}`} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-teal-800 shadow-sm hover:bg-teal-50">
                <Home className="h-4 w-4" /> My office
              </Link>
            )}
            <button type="button" onClick={() => setPrivacyOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold text-white hover:bg-white/25">
              <EyeOff className="h-4 w-4" /> Privacy
            </button>
          </div>
        </div>
        {overview && (
          <div className="relative mt-6 flex flex-wrap gap-2">
            <Stat icon={Building2} label="Offices" value={overview.totals.offices} />
            <Stat icon={Users} label="Employees" value={overview.totals.employees} />
            <Stat icon={Layers} label="Office types" value={overview.totals.office_types} />
          </div>
        )}
      </header>

      <UnpaidBanner />

      <nav className="flex gap-1 rounded-2xl border border-border bg-surface p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => update({ tab: t.id === 'offices' ? '' : t.id, type: t.id === 'offices' ? typeId : '' })}
            className={cn(
              'flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              tab === t.id ? 'bg-primary text-white shadow-sm' : 'text-muted hover:bg-slate-50 hover:text-foreground',
            )}
          >
            <t.icon className="h-4 w-4 shrink-0" />
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sr-only sm:hidden">{t.label}</span>
          </button>
        ))}
      </nav>

      {error && <Alert variant="error">{error}</Alert>}

      {tab === 'offices' &&
        (overview ? (
          <OfficesTab overview={overview} typeId={typeId} setTypeId={(id) => update({ type: id })} />
        ) : (
          !error && (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-64 rounded-2xl" />
              ))}
            </div>
          )
        ))}
      {tab === 'employees' && <EmployeeDirectory />}
      {tab === 'batchmates' && <Batchmates />}
      {tab === 'favorites' && <FavoritesTab />}

      {privacyOpen && <PrivacyDialog onClose={() => setPrivacyOpen(false)} />}
    </div>
  );
}
