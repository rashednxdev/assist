'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookUser, Lock, PhoneCall, X } from 'lucide-react';
import type { ContactAccess } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { WorkIdentityForm } from '@/components/org/work-identity-form';

interface Ctx {
  access: ContactAccess;
  /** Explain why dialing is locked and point to packages. */
  requestUpgrade: () => void;
  setAccess: (a: ContactAccess) => void;
}

const ContactAccessContext = createContext<Ctx | null>(null);

export function useContactAccess(): Ctx {
  const ctx = useContext(ContactAccessContext);
  if (!ctx) throw new Error('useContactAccess must be used inside <ContactsGate>');
  return ctx;
}

function UpgradeDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm space-y-4 rounded-2xl bg-surface p-6 text-center shadow-xl">
        <button type="button" onClick={onClose} className="absolute right-3 top-3 rounded-lg p-1 text-muted hover:bg-slate-100" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-muted text-primary">
          <PhoneCall className="h-6 w-6" />
        </span>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Calling needs a package</h2>
          <p className="text-sm text-muted">
            The contact directory is free to browse. To see full phone numbers, call, WhatsApp or save contacts, buy any package.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button asChild>
            <Link href="/packages">View packages</Link>
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Loads directory access; asks for office + designation first, then provides access to children. */
export function ContactsGate({ children }: { children: React.ReactNode }) {
  const [access, setAccess] = useState<ContactAccess | null>(null);
  const [error, setError] = useState('');
  const [upgrade, setUpgrade] = useState(false);

  const load = useCallback(() => {
    apiFetch<{ data: ContactAccess }>('/contacts/access')
      .then((r) => setAccess(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not open contacts'));
  }, []);

  useEffect(load, [load]);

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!access) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 rounded-3xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!access.ready) {
    return (
      <div className="mx-auto max-w-2xl space-y-5 pt-4">
        <div className="space-y-3 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-muted text-primary">
            <BookUser className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Contacts directory</h1>
          <p className="text-muted">
            Add your <strong>designation</strong> and <strong>office</strong> to open the directory. Colleagues will find you under your office, and you can browse every office, sub-office and employee.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
          <WorkIdentityForm submitLabel="Save and open contacts" onSaved={load} />
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted">
          <Lock className="h-3.5 w-3.5" /> You can hide your mobile number or email from the directory at any time.
        </p>
      </div>
    );
  }

  return (
    <ContactAccessContext.Provider value={{ access, setAccess, requestUpgrade: () => setUpgrade(true) }}>
      {children}
      {upgrade && <UpgradeDialog onClose={() => setUpgrade(false)} />}
    </ContactAccessContext.Provider>
  );
}
