'use client';

import { useState } from 'react';
import { Check, Copy, KeyRound, Loader2, MessageCircle, X } from 'lucide-react';
import { TEMP_PASSWORD_TTL_HOURS, type TempPasswordResult } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { phoneWhatsAppHref } from '@/lib/contact';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

export interface TempPasswordTarget {
  id: string;
  full_name_en: string;
  phone: string;
  status?: string;
  bound_device_label?: string | null;
}

function expiryText(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function TempPasswordDialog({
  user,
  onClose,
  onDone,
}: {
  user: TempPasswordTarget;
  onClose: () => void;
  onDone?: (result: TempPasswordResult) => void;
}) {
  const [password, setPassword] = useState('');
  const [clearDevice, setClearDevice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<TempPasswordResult | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const r = await apiFetch<{ data: TempPasswordResult }>(`/users/${user.id}/temp-password`, {
        method: 'POST',
        body: JSON.stringify({ password: password.trim() || undefined, clear_bound_device: clearDevice || undefined }),
      });
      setResult(r.data);
      onDone?.(r.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set the temporary password');
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!result) return;
    await navigator.clipboard.writeText(result.temp_password).catch(() => undefined);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  const message = result
    ? `Hi ${user.full_name_en}, your ProAssist temporary password is ${result.temp_password} . Sign in with your mobile number and this password, then set your own new password. It works until ${expiryText(result.expires_at)}.`
    : '';
  const wa = result && user.phone ? phoneWhatsAppHref(user.phone, message) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-slate-900/50" onClick={() => !busy && onClose()} />
      <div className="relative w-full max-w-md rounded-2xl bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <KeyRound className="h-5 w-5 text-primary" />
              Temporary password
            </h2>
            <p className="text-sm text-muted">
              {user.full_name_en} · {user.phone}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg p-1 text-muted hover:bg-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {result ? (
          <div className="space-y-4 p-5 text-sm">
            <Alert variant="success">
              Done. The account is active again and every old session was signed out.
            </Alert>
            <div className="space-y-1">
              <Label>Temporary password</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-border bg-slate-50 px-3 py-2 text-lg font-semibold tracking-wider">
                  {result.temp_password}
                </code>
                <Button type="button" variant="outline" onClick={copy}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
              <p className="text-xs text-muted">Works until {expiryText(result.expires_at)}. It is shown only now.</p>
            </div>
            <p className="text-muted">
              Give it to the user. They sign in with their mobile number and this password, then the app asks them to set their own
              new password before anything else.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row">
              {wa && (
                <Button asChild variant="outline" className="flex-1">
                  <a href={wa} target="_blank" rel="noreferrer">
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                    Send on WhatsApp
                  </a>
                </Button>
              )}
              <Button type="button" className="flex-1" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4 p-5 text-sm">
            <p className="text-muted">
              This reactivates the account{user.status && user.status !== 'active' ? ` (now ${user.status})` : ''}, clears any
              wrong-password lock and signs out every device. The temporary password works for {TEMP_PASSWORD_TTL_HOURS} hours and
              the user must replace it right after signing in.
            </p>
            <div className="space-y-1">
              <Label htmlFor="temp-pass">Temporary password</Label>
              <Input
                id="temp-pass"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank to generate one"
                autoComplete="off"
              />
            </div>
            <label className="flex items-start gap-2">
              <input type="checkbox" checked={clearDevice} onChange={(e) => setClearDevice(e.target.checked)} className="mt-0.5" />
              <span>
                Also clear the bound device (the user is on a new phone)
                {user.bound_device_label ? <span className="block text-xs text-muted">Now bound to: {user.bound_device_label}</span> : null}
              </span>
            </label>
            {error && <Alert variant="error">{error}</Alert>}
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                Set temporary password
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
