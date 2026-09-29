'use client';

import { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';
import type { ContactAccess, ContactPrivacy } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';

function Toggle({ checked, disabled, onChange, label, hint }: { checked: boolean; disabled?: boolean; onChange: (v: boolean) => void; label: string; hint: string }) {
  return (
    <label className={cn('flex cursor-pointer items-start justify-between gap-4', disabled && 'opacity-60')}>
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted">{hint}</span>
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn('relative mt-0.5 inline-flex h-6 w-11 shrink-0 rounded-full transition', checked ? 'bg-primary' : 'bg-slate-300')}
      >
        <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
      </button>
    </label>
  );
}

/** Lets the signed-in user hide their mobile number / email from the contacts directory. */
export function DirectoryPrivacy({ initial, onChange, className }: { initial?: ContactPrivacy; onChange?: (p: ContactPrivacy) => void; className?: string }) {
  const [privacy, setPrivacy] = useState<ContactPrivacy | null>(initial ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initial) return;
    apiFetch<{ data: ContactAccess }>('/contacts/access')
      .then((r) => setPrivacy(r.data.privacy))
      .catch(() => setPrivacy({ hide_phone: false, hide_email: false }));
  }, [initial]);

  async function save(next: ContactPrivacy) {
    const prev = privacy;
    setPrivacy(next);
    setBusy(true);
    setError('');
    try {
      const r = await apiFetch<{ data: ContactPrivacy }>('/contacts/me/privacy', { method: 'PUT', body: JSON.stringify(next) });
      setPrivacy(r.data);
      onChange?.(r.data);
    } catch (e) {
      setPrivacy(prev);
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  if (!privacy) return null;
  return (
    <div className={cn('space-y-3', className)}>
      <p className="flex items-center gap-2 text-sm font-semibold">
        <EyeOff className="h-4 w-4 text-muted" /> Directory privacy
      </p>
      <Toggle
        label="Hide my mobile number"
        hint="Colleagues see your name, designation and office, but not your number."
        checked={privacy.hide_phone}
        disabled={busy}
        onChange={(v) => save({ ...privacy, hide_phone: v })}
      />
      <Toggle label="Hide my email" hint="Your email is left out of the contacts directory." checked={privacy.hide_email} disabled={busy} onChange={(v) => save({ ...privacy, hide_email: v })} />
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
