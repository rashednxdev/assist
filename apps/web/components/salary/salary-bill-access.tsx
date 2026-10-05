'use client';

import { useState } from 'react';
import { MessageCircle, Phone } from 'lucide-react';
import type { SalaryBillAccessRecord, SalaryContactNumber } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { localNum, salaryCopy, type SalaryCopy, type SalaryLocale } from '@/lib/salary-i18n';

function whatsappHref(number: string): string {
  const digits = number.replace(/\D/g, '');
  const intl = digits.length === 11 && digits.startsWith('0') ? `88${digits}` : digits;
  return `https://wa.me/${intl}`;
}

function statusLabel(t: SalaryCopy, access: SalaryBillAccessRecord): string {
  if (access.unlimited || access.remaining > 0) return t.accessStatusApproved;
  if (access.request.pending) return t.accessStatusPending;
  if (access.status === 'rejected') return t.accessStatusRejected;
  if (access.bill_limit > 0) return t.accessStatusUsedUp;
  return t.accessStatusNone;
}

function SectionFrame({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-red-100 bg-gradient-to-br from-rose-50 via-white to-white shadow-sm print:hidden">
      <div className="flex items-center justify-between gap-2 bg-gradient-to-br from-red-600 via-rose-600 to-red-900 px-4 py-2.5">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        {badge ? (
          <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-red-700">{badge}</span>
        ) : null}
      </div>
      <div className="space-y-3 px-4 py-3 text-sm text-slate-700">{children}</div>
    </section>
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
      <SectionFrame title={t.accessTitle}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{loadError ? t.accessLoadError : '…'}</span>
          {loadError ? (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              {t.retry}
            </Button>
          ) : null}
        </div>
      </SectionFrame>
    );
  }

  if (access.unlimited) {
    return (
      <SectionFrame title={t.accessTitle} badge={statusLabel(t, access)}>
        <p>{t.accessUnlimited}</p>
      </SectionFrame>
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
    <SectionFrame title={t.accessTitle} badge={statusLabel(t, access)}>
      <div className="space-y-1">
        {access.remaining > 0 ? (
          <p className="font-semibold text-red-700">
            {t.accessRemaining(num(access.remaining), num(access.bill_limit), num(access.bills_used))}
          </p>
        ) : access.status === 'none' ? (
          <p className="font-semibold text-red-700">{t.accessNone}</p>
        ) : access.bill_limit > 0 && !pending ? (
          <p className="font-semibold text-red-700">{t.accessUsedUp(num(access.bill_limit))}</p>
        ) : null}
        {pending ? (
          <p className="font-semibold text-red-700">{t.accessPending(num(access.request.requested_bills ?? 0))}</p>
        ) : null}
        {access.status === 'rejected' && !pending ? <p className="font-semibold text-red-700">{t.accessRejected}</p> : null}
        {access.admin_note && !pending ? (
          <p className="text-xs">
            <span className="font-semibold">{t.accessAdminNote}:</span> {access.admin_note}
          </p>
        ) : null}
        <p className="text-xs text-slate-500">{t.accessUseNote}</p>
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
            />
          </div>
          <div className="sm:col-span-2">
            <Button type="button" onClick={() => void submit()} disabled={sending} className="bg-red-600 shadow-sm hover:bg-red-700">
              {sending ? t.requestSending : requestLabel}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={() => setFormOpen(true)} className="border-red-200 bg-white text-red-700 hover:bg-rose-50">
          {requestLabel}
        </Button>
      )}

      {error ? <Alert variant="error">{error}</Alert> : null}
    </SectionFrame>
  );
}

export function SalaryBillContacts({ locale, contacts }: { locale: SalaryLocale; contacts: SalaryContactNumber[] }) {
  const t = salaryCopy(locale);
  if (contacts.length === 0) return null;
  return (
    <SectionFrame title={t.contactsTitle}>
      <div className="-mx-4 -my-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-rose-50 text-left text-xs font-semibold uppercase tracking-wide text-red-700">
            <tr>
              <th className="w-10 px-4 py-2">#</th>
              <th className="px-4 py-2">{t.contactName}</th>
              <th className="px-4 py-2">{t.contactNumber}</th>
              <th className="px-4 py-2">{t.whatsapp}</th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((c, i) => (
              <tr key={`${c.number}-${i}`} className="border-t border-red-100">
                <td className="px-4 py-2 text-slate-500">{localNum(locale, i + 1)}</td>
                <td className="px-4 py-2 font-medium text-slate-800">{c.label || '—'}</td>
                <td className="px-4 py-2">
                  <a
                    href={`tel:${c.number.replace(/\s/g, '')}`}
                    className="inline-flex items-center gap-1.5 font-mono font-semibold text-red-700 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {c.number}
                  </a>
                </td>
                <td className="px-4 py-2">
                  {c.whatsapp ? (
                    <a
                      href={whatsappHref(c.number)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm hover:bg-red-700"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {t.whatsapp}
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionFrame>
  );
}
