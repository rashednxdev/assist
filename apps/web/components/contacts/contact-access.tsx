'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookUser, Check, Copy, Lock, PhoneCall, RefreshCw, X } from 'lucide-react';
import { CONTACT_VERIFIER_GRADE_MAX, type ContactAccess, type ContactVerificationInfo } from '@ibas/shared-types';
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

function VerificationStep({
  access,
  onChange,
  onRefresh,
}: {
  access: ContactAccess;
  onChange: (a: ContactAccess) => void;
  onRefresh: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const code = access.verification?.code;

  async function regenerate() {
    setBusy(true);
    setError('');
    try {
      const r = await apiFetch<{ data: ContactVerificationInfo }>('/contacts/verification/code', { method: 'POST' });
      onChange({ ...access, verification: r.data });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not get a new code');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!code) return;
    await navigator.clipboard.writeText(code).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 text-center shadow-sm">
      <p className="text-sm text-muted">
        Share this code with a verified colleague of grade 1–{CONTACT_VERIFIER_GRADE_MAX}. They enter it under <strong>Verify a colleague</strong> in the
        app&apos;s home menu. The directory opens as soon as they confirm.
      </p>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Your verification code</p>
        <p className="mt-1 font-mono text-4xl font-bold tracking-[0.3em] text-primary">{code ? `${code.slice(0, 4)} ${code.slice(4)}` : '—'}</p>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => void copy()} disabled={!code}>
          <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy code'}
        </Button>
        <Button variant="outline" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4" /> I&apos;ve been verified
        </Button>
        <Button variant="ghost" onClick={() => void regenerate()} disabled={busy}>
          {busy ? 'Getting a new code…' : 'Get a new code'}
        </Button>
      </div>
      <p className="text-xs text-muted">
        Wrong office or designation?{' '}
        <Link href="/settings/profile" className="font-medium text-primary hover:underline">
          Change it
        </Link>
      </p>
    </div>
  );
}

const SHARED_DETAILS = [
  'Your name and photo initials',
  'Department, office, section and designation',
  'Mobile, desk telephone and PABX',
  'Email address',
  'Additional charges you hold',
];

/** Agree (or stop agreeing) to be listed; the same call opens or closes the directory for regular users. */
export async function saveContactConsent(accept: boolean): Promise<ContactAccess> {
  const r = await apiFetch<{ data: ContactAccess }>('/contacts/me/consent', { method: 'PUT', body: JSON.stringify({ accept }) });
  return r.data;
}

function ConsentStep({ onChange }: { onChange: (a: ContactAccess) => void }) {
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function accept() {
    setBusy(true);
    setError('');
    try {
      onChange(await saveContactConsent(true));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your consent');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
      <p className="text-sm text-muted">
        Contacts is a shared directory. To use it, you agree that other Contacts users can see these details about you:
      </p>
      <ul className="space-y-1.5 text-sm">
        {SHARED_DETAILS.map((d) => (
          <li key={d} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" /> {d}
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        You can hide your mobile number or email at any time, and you can stop sharing from Privacy — you then leave the directory.
      </p>
      <label className="flex items-start gap-2 text-sm font-medium">
        <input type="checkbox" className="mt-0.5" checked={agree} onChange={(e) => setAgree(e.target.checked)} />I agree to share my details with
        Contacts users
      </label>
      {error && <Alert variant="error">{error}</Alert>}
      <Button onClick={() => void accept()} disabled={!agree || busy}>
        {busy ? 'Saving…' : 'Agree and continue'}
      </Button>
    </div>
  );
}

/** Loads directory access; asks for consent, office + designation, then a colleague's verification, before showing children. */
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
    const step = !access.consented ? 1 : !access.work ? 2 : 3;
    return (
      <div className="mx-auto max-w-2xl space-y-5 pt-4">
        <div className="space-y-3 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-muted text-primary">
            <BookUser className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Contacts directory</h1>
          <ol className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-xs">
            {['Consent to share', 'Office & designation', 'Colleague verification'].map((label, i) => {
              const on = i + 1 <= step;
              return (
                <li key={label} className={`flex items-center gap-2 ${i + 1 === step ? 'font-semibold text-foreground' : 'text-muted'}`}>
                  <span className={`flex h-6 w-6 items-center justify-center rounded-full border ${on ? 'border-primary bg-primary text-white' : 'border-border'}`}>
                    {i + 1 < step ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  {label}
                </li>
              );
            })}
          </ol>
          {step === 2 && (
            <p className="text-muted">
              Add your <strong>department</strong>, <strong>office</strong> and <strong>designation</strong>. Colleagues will find you under your office,
              and you can browse your department&apos;s offices and employees — and other departments too.
            </p>
          )}
        </div>
        {step === 1 ? (
          <ConsentStep onChange={setAccess} />
        ) : step === 2 ? (
          <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <WorkIdentityForm submitLabel="Save and continue" onSaved={load} />
          </div>
        ) : (
          <VerificationStep access={access} onChange={setAccess} onRefresh={load} />
        )}
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
