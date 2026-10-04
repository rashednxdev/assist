'use client';

import { useState } from 'react';
import { FileDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SalaryCopy } from '@/lib/salary-i18n';

export interface SalaryPrintInfo {
  office: string;
  employee: string;
  designation: string;
}

export const EMPTY_PRINT_INFO: SalaryPrintInfo = { office: '', employee: '', designation: '' };

export function SalaryPrintDialog({
  t,
  initial,
  onCancel,
  onConfirm,
}: {
  t: SalaryCopy;
  initial: SalaryPrintInfo;
  onCancel: () => void;
  onConfirm: (info: SalaryPrintInfo) => void;
}) {
  const [info, setInfo] = useState<SalaryPrintInfo>(initial);
  const set = (key: keyof SalaryPrintInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setInfo((prev) => ({ ...prev, [key]: e.target.value }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    onConfirm({
      office: info.office.trim(),
      employee: info.employee.trim(),
      designation: info.designation.trim(),
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
              {t.printTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.printHint}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div className="space-y-1.5">
            <Label htmlFor="print-office">{t.officeName}</Label>
            <Input id="print-office" value={info.office} onChange={set('office')} autoComplete="organization" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="print-employee">{t.employeeName}</Label>
            <Input id="print-employee" value={info.employee} onChange={set('employee')} autoComplete="name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="print-designation">{t.designation}</Label>
            <Input id="print-designation" value={info.designation} onChange={set('designation')} autoComplete="organization-title" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button type="submit" className="gap-2">
            <FileDown className="h-4 w-4" />
            {t.printNow}
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
