'use client';

import { useState } from 'react';
import { MessageCircle, Phone, Plus, X } from 'lucide-react';
import { SALARY_MAX_BULKS_PER_REQUEST, type SalaryBillAccessRecord, type SalaryContactNumber } from '@ibas/shared-types';
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

function BulkRequestForm({
  locale,
  access,
  onSent,
  onCancel,
}: {
  locale: SalaryLocale;
  access: SalaryBillAccessRecord;
  onSent: (access: SalaryBillAccessRecord) => void;
  onCancel: () => void;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const [count, setCount] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const countText = count ?? String(access.request.requested_bulks ?? 1);
  const requested = Number(countText);
  const validCount = Number.isInteger(requested) && requested >= 1 && requested <= SALARY_MAX_BULKS_PER_REQUEST;

  async function submit() {
    if (!validCount) {
      setError(`${t.requestBulks}: ${num(1)} – ${num(SALARY_MAX_BULKS_PER_REQUEST)}`);
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await apiFetch<{ data: SalaryBillAccessRecord }>('/salary/access/request', {
        method: 'POST',
        body: JSON.stringify({ requested_bulks: requested, note: note.trim() }),
      });
      onSent(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="grid gap-3 rounded-xl border border-red-100 bg-white p-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="space-y-1">
          <Label htmlFor="salary-request-count" className="text-xs">
            {t.requestBulks}
          </Label>
          <Input
            id="salary-request-count"
            type="number"
            min={1}
            max={SALARY_MAX_BULKS_PER_REQUEST}
            inputMode="numeric"
            value={countText}
            onChange={(e) => setCount(e.target.value)}
          />
          <p className="rounded-md bg-amber-100 px-2 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-300">
            {t.requestBulkInfo(num(access.bulk_size), validCount ? num(requested * access.bulk_size) : '—')}
          </p>
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
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button type="button" onClick={() => void submit()} disabled={sending} className="bg-red-600 shadow-sm hover:bg-red-700">
            {sending ? t.requestSending : t.requestBtn}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={sending}
            className="border-red-200 bg-white text-red-700 hover:bg-rose-50"
          >
            {t.cancel}
          </Button>
        </div>
      </div>
      {error ? <Alert variant="error">{error}</Alert> : null}
    </>
  );
}

/** Opened when a T.R. Form download is pressed with no approved bills left. */
export function SalaryBulkRequestDialog({
  locale,
  access,
  message,
  onAccessChange,
  onClose,
}: {
  locale: SalaryLocale;
  access: SalaryBillAccessRecord;
  message?: string;
  onAccessChange: (access: SalaryBillAccessRecord) => void;
  onClose: () => void;
}) {
  const t = salaryCopy(locale);
  const [sent, setSent] = useState(false);
  const pending = access.request.pending;
  const reason =
    message ??
    (pending
      ? undefined
      : access.status === 'rejected'
        ? t.accessRejected
        : access.bill_limit > 0
          ? t.accessUsedUp(localNum(locale, access.bill_limit))
          : t.accessNone);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 bg-gradient-to-br from-red-600 via-rose-600 to-red-900 px-5 py-3 text-white">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Plus className="h-5 w-5" />
            {sent ? t.requestSent : pending ? t.requestUpdateBtn : access.remaining > 0 ? t.newBulkBtn : t.requestDialogTitle}
          </h2>
          <button type="button" onClick={onClose} className="rounded-md p-1 hover:bg-white/15" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-5 text-sm text-slate-700">
          {sent ? (
            <>
              <Alert variant="success">
                <span className="block font-semibold">{t.requestSent}</span>
                <span className="block text-xs">{access.contacts.length > 0 ? t.contactAdminHint : t.contactAdminNoNumbers}</span>
              </Alert>
              <div className="flex justify-end">
                <Button type="button" onClick={onClose} className="min-w-24 bg-red-600 shadow-sm hover:bg-red-700" autoFocus>
                  {t.ok}
                </Button>
              </div>
            </>
          ) : (
            <>
              {reason ? <p className="font-semibold text-red-700">{reason}</p> : null}
              <p>{pending ? t.requestDialogPending : t.requestDialogHint}</p>
              <BulkRequestForm
                locale={locale}
                access={access}
                onSent={(next) => {
                  onAccessChange(next);
                  setSent(true);
                }}
                onCancel={onClose}
              />
            </>
          )}
        </div>
      </div>
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
  const [sent, setSent] = useState(false);

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
  const openLabel = pending ? t.requestUpdateBtn : t.newBulkBtn;
  const contactHint = access.contacts.length > 0 ? t.contactAdminHint : t.contactAdminNoNumbers;

  return (
    <SectionFrame title={t.accessTitle} badge={statusLabel(t, access)}>
      <div className="overflow-x-auto rounded-xl border border-red-100 bg-white">
        <table className="w-full min-w-[30rem] text-sm">
          <thead className="bg-rose-50 text-left text-xs font-semibold text-red-700">
            <tr>
              <th className="px-3 py-2">{t.accessColSubmitted}</th>
              <th className="px-3 py-2 text-right">{t.accessColApproved}</th>
              <th className="px-3 py-2 text-right">{t.accessColUsed}</th>
              <th className="px-3 py-2 text-right">{t.accessColRemaining}</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-red-100 align-top">
              <td className="px-3 py-2">
                {pending ? (
                  <>
                    <span className="block font-semibold text-slate-800">
                      {t.accessSubmittedBills(
                        num(access.request.requested_bills ?? 0),
                        access.request.requested_bulks ? num(access.request.requested_bulks) : null,
                      )}
                    </span>
                    <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                      {t.accessWaiting}
                    </span>
                  </>
                ) : (
                  <span className="text-xs text-slate-500">{t.accessNoRequest}</span>
                )}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">
                {t.accessBillsUnit(num(access.bill_limit))}
              </td>
              <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-800">
                {t.accessBillsUnit(num(access.bills_used))}
              </td>
              <td
                className={`px-3 py-2 text-right font-bold tabular-nums ${access.remaining > 0 ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {t.accessBillsUnit(num(access.remaining))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="space-y-1">
        {access.status === 'none' && !pending ? <p className="font-semibold text-red-700">{t.accessNone}</p> : null}
        {access.status !== 'none' && access.bill_limit > 0 && access.remaining === 0 && !pending ? (
          <p className="font-semibold text-red-700">{t.accessUsedUp(num(access.bill_limit))}</p>
        ) : null}
        {access.status === 'rejected' && !pending ? <p className="font-semibold text-red-700">{t.accessRejected}</p> : null}
        {access.admin_note && !pending ? (
          <p className="text-xs">
            <span className="font-semibold">{t.accessAdminNote}:</span> {access.admin_note}
          </p>
        ) : null}
        <p className="text-xs text-slate-500">{t.accessUseNote(num(access.bulk_size))}</p>
        <p className="text-xs font-semibold text-amber-800">
          {access.calc.free_used < access.calc.free_limit
            ? t.calcFreeLeft(num(access.calc.free_limit - access.calc.free_used), num(access.calc.free_limit))
            : access.calc.free_limit === 0 && access.remaining === 0
              ? t.calcNoFree
              : t.calcCounted(num(access.calc.unprinted), num(access.calc.per_bill))}
        </p>
      </div>

      {sent ? (
        <Alert variant="success">
          <span className="block font-semibold">{t.requestSent}</span>
          <span className="block text-xs">{contactHint}</span>
        </Alert>
      ) : pending ? (
        <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-white px-3 py-2 text-xs font-medium text-red-800">
          <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{contactHint}</span>
        </div>
      ) : null}

      {formOpen ? (
        <BulkRequestForm
          locale={locale}
          access={access}
          onSent={(next) => {
            onAccessChange(next);
            setSent(true);
            setFormOpen(false);
          }}
          onCancel={() => setFormOpen(false)}
        />
      ) : (
        <Button
          type="button"
          size="sm"
          onClick={() => {
            setFormOpen(true);
            setSent(false);
          }}
          className="gap-1.5 bg-red-600 text-white shadow-sm hover:bg-red-700"
        >
          <Plus className="h-4 w-4" />
          {openLabel}
        </Button>
      )}
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
