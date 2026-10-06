'use client';

import { useState } from 'react';
import { FileDown, ShieldCheck, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toEnglishDigits } from '@/lib/bangla-format';
import type { SalaryCopy } from '@/lib/salary-i18n';

export interface SalaryPrintInfo {
  office: string;
  employee: string;
  designation: string;
  nid: string;
}

export const EMPTY_PRINT_INFO: SalaryPrintInfo = { office: '', employee: '', designation: '', nid: '' };

const NID_LENGTHS = [10, 13, 17];

export function SalaryPrintDialog({
  t,
  initial,
  onCancel,
  onConfirm,
  title,
  confirmLabel,
  requireName = false,
  lockedOffice = '',
}: {
  t: SalaryCopy;
  initial: SalaryPrintInfo;
  onCancel: () => void;
  onConfirm: (info: SalaryPrintInfo) => void;
  title?: string;
  confirmLabel?: string;
  requireName?: boolean;
  /** Office name fixed by the user's office (the Bangla name for "Others"); shown read-only. */
  lockedOffice?: string;
}) {
  const [info, setInfo] = useState<SalaryPrintInfo>(lockedOffice ? { ...initial, office: lockedOffice } : initial);
  const [nameError, setNameError] = useState(false);
  const [nidError, setNidError] = useState(false);
  const set = (key: keyof SalaryPrintInfo) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (key === 'employee') setNameError(false);
    if (key === 'nid') setNidError(false);
    const value = key === 'nid' ? toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 17) : e.target.value;
    setInfo((prev) => ({ ...prev, [key]: value }));
  };

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const nid = info.nid.trim();
    const badName = requireName && !info.employee.trim();
    const badNid = nid !== '' && !NID_LENGTHS.includes(nid.length);
    setNameError(badName);
    setNidError(badNid);
    if (badName || badNid) return;
    onConfirm({
      office: lockedOffice || info.office.trim(),
      employee: info.employee.trim(),
      designation: info.designation.trim(),
      nid,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <form onSubmit={submit} className="relative w-full max-w-md rounded-2xl bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <FileDown className="h-5 w-5 text-primary" />
              {title ?? t.printTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">{requireName ? t.printHintNameRequired : t.printHint}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t.printPrivacyNote}</span>
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="print-office">{t.officeName}</Label>
            <Input
              id="print-office"
              value={info.office}
              onChange={set('office')}
              autoComplete="organization"
              readOnly={Boolean(lockedOffice)}
              autoFocus={!lockedOffice}
              className={lockedOffice ? 'cursor-not-allowed bg-slate-100' : undefined}
            />
            {lockedOffice ? <p className="text-xs text-muted">{t.officeFixedOnBill}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="print-employee">
              {t.employeeName}
              {requireName ? <span className="text-destructive"> *</span> : null}
            </Label>
            <Input
              id="print-employee"
              value={info.employee}
              onChange={set('employee')}
              autoComplete="name"
              required={requireName}
              aria-invalid={nameError || undefined}
              className={nameError ? 'border-destructive focus-visible:ring-destructive/30' : undefined}
            />
            {nameError ? <p className="text-xs font-medium text-destructive">{t.nameRequired}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="print-designation">{t.designation}</Label>
            <Input id="print-designation" value={info.designation} onChange={set('designation')} autoComplete="organization-title" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="print-nid">{t.nid}</Label>
            <Input
              id="print-nid"
              value={info.nid}
              onChange={set('nid')}
              inputMode="numeric"
              autoComplete="off"
              placeholder={t.nidPlaceholder}
              aria-invalid={nidError || undefined}
              className={`tabular-nums ${nidError ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
            />
            {nidError ? <p className="text-xs font-medium text-destructive">{t.nidInvalid}</p> : null}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button type="submit" className="gap-2">
            <FileDown className="h-4 w-4" />
            {confirmLabel ?? t.printNow}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Office / employee block shown only in the printed PDF. */
export function SalaryPrintMeta({ t, info, preparedOn }: { t: SalaryCopy; info: SalaryPrintInfo; preparedOn: string }) {
  const rows: Array<[string, string]> = [
    [t.officeName, info.office],
    [t.employeeName, info.employee],
    [t.designation, info.designation],
    [t.nid, info.nid],
  ];
  const filled = rows.filter(([, value]) => value);
  return (
    <div className="salary-print-meta hidden rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm print:block">
      {filled.map(([label, value]) => (
        <div key={label} className="flex gap-2">
          <span className="min-w-[110px] font-semibold text-slate-700">{label}:</span>
          <span className="text-slate-900">{value}</span>
        </div>
      ))}
      <div className="flex gap-2 text-xs text-slate-600">
        <span className="min-w-[110px] font-semibold">{t.preparedOn}:</span>
        <span>{preparedOn}</span>
      </div>
    </div>
  );
}
