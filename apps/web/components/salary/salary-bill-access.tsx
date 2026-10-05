'use client';

import { useState } from 'react';
import { MessageCircle, Phone, ShieldCheck } from 'lucide-react';
import type { SalaryBillAccessRecord, SalaryContactNumber } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { localNum, salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';

function whatsappHref(number: string): string {
  const digits = number.replace(/\D/g, '');
  const intl = digits.length === 11 && digits.startsWith('0') ? `88${digits}` : digits;
  return `https://wa.me/${intl}`;
}

function ContactList({ title, contacts, whatsappLabel }: { title: string; contacts: SalaryContactNumber[]; whatsappLabel: string }) {
  if (contacts.length === 0) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900/80">{title}</p>
      <ul className="space-y-1.5">
        {contacts.map((c, i) => (
          <li key={`${c.number}-${i}`} className="flex flex-wrap items-center gap-2 text-sm">
            {c.label ? <span className="font-medium text-slate-800">{c.label}:</span> : null}
            <a href={`tel:${c.number.replace(/\s/g, '')}`} className="inline-flex items-center gap-1 font-mono font-semibold text-indigo-800 hover:underline">
              <Phone className="h-3.5 w-3.5" />
              {c.number}
            </a>
            {c.whatsapp ? (
              <a
                href={whatsappHref(c.number)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-200"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {whatsappLabel}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SalaryBillAccessPanel({
  locale,
  access,
  loadError,
  onRetry,
  onAccessChange,
}: {
  locale: SalaryLocale;
  access: SalaryBillAccessRecord | null;
  loadError: boolean;
  onRetry: () => void;
  onAccessChange: (access: SalaryBillAccessRecord) => void;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const [formOpen, setFormOpen] = useState(false);
  const [count, setCount] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  if (loadError || !access) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
        <span>{loadError ? t.accessLoadError : '…'}</span>
        {loadError ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry}>
            {t.retry}
          </Button>
        ) : null}
      </div>
    );
  }

  if (access.unlimited) {
    return (
      <p className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 print:hidden">
        <ShieldCheck className="h-4 w-4" />
        {t.accessUnlimited}
      </p>
    );
  }

  const pending = access.request.pending;
  const showForm = formOpen || access.remaining === 0;
  const requestLabel = pending ? t.requestUpdateBtn : access.bill_limit > 0 ? t.requestMoreBtn : t.requestBtn;
  const countText = count ?? String(access.request.requested_bills ?? 1);
  const requested = Number(countText);

  async function submit() {
    if (!Number.isInteger(requested) || requested < 1 || requested > 1000) {
      setError(`${t.requestBills}: ${num(1)} – ${num(1000)}`);
      return;
    }
    setSending(true);
    setError('');
    setSent(false);
    try {
      const res = await apiFetch<{ data: SalaryBillAccessRecord }>('/salary/access/request', {
        method: 'POST',
        body: JSON.stringify({ requested_bills: requested, note: note.trim() }),
      });
      onAccessChange(res.data);
      setSent(true);
      setFormOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/60 px-4 py-3 print:hidden">
      <div className="space-y-1">
        <p className="text-sm font-bold text-indigo-950">{t.accessTitle}</p>
        {access.remaining > 0 ? (
          <p className="text-sm font-semibold text-emerald-800">
            {t.accessRemaining(num(access.remaining), num(access.bill_limit), num(access.bills_used))}
          </p>
        ) : access.status === 'none' ? (
          <p className="text-sm font-semibold text-indigo-900">{t.accessNone}</p>
        ) : access.bill_limit > 0 && !pending ? (
          <p className="text-sm font-semibold text-rose-800">{t.accessUsedUp(num(access.bill_limit))}</p>
        ) : null}
        {pending ? (
          <p className="text-sm font-semibold text-amber-800">
            {t.accessPending(num(access.request.requested_bills ?? 0))}
          </p>
        ) : null}
        {access.status === 'rejected' && !pending ? (
          <p className="text-sm font-semibold text-rose-800">{t.accessRejected}</p>
        ) : null}
        {access.admin_note && !pending ? (
          <p className="text-xs text-slate-700">
            <span className="font-semibold">{t.accessAdminNote}:</span> {access.admin_note}
          </p>
        ) : null}
        <p className="text-xs text-indigo-900/80">{t.accessUseNote}</p>
      </div>

      {sent ? <Alert variant="success">{t.requestSent}</Alert> : null}

      {showForm ? (
        <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
          <div className="space-y-1">
            <Label htmlFor="salary-request-count" className="text-xs">
              {t.requestBills}
            </Label>
            <Input
              id="salary-request-count"
              type="number"
              min={1}
              max={1000}
              inputMode="numeric"
              value={countText}
              onChange={(e) => setCount(e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="salary-request-note" className="text-xs">
              {t.requestNote}
            </Label>
            <Input
              id="salary-request-note"
              maxLength={500}
              value={note}
              placeholder={t.requestNotePlaceholder}
              onChange={(e) => setNote(e.target.value)}
              className="bg-white"
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" onClick={() => void submit()} disabled={sending} className="bg-indigo-700 hover:bg-indigo-800">
              {sending ? t.requestSending : requestLabel}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setFormOpen(true)} className="border-indigo-300 text-indigo-800">
          {requestLabel}
        </Button>
      )}

      {error ? <Alert variant="error">{error}</Alert> : null}

      <ContactList title={t.contactsTitle} contacts={access.contacts} whatsappLabel={t.whatsapp} />
    </div>
  );
}
