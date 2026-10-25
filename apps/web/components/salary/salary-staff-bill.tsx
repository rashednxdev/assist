'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Download, Loader2, Pencil, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import {
  NPS_2015,
  PAY_GRADES,
  isIsoDate,
  SALARY_BILL_LIMIT_CODE,
  SALARY_CALC_LIMIT_CODE,
  calculateStaffArrears,
  formatTaka,
  isIncrementWithheld,
  asksJoiningDate,
  salaryStaffNameChangeTooLarge,
  type HousingStatus,
  type HraArea,
  type PayGrade,
  type SalaryArrearResult,
  type SalaryBillAccessRecord,
  type SalaryStaffDto,
  type SalaryStaffOfficeRecord,
  type SalaryStaffRecord,
} from '@ibas/shared-types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ArrearExtraDeductions,
  ArrearMonthPicker,
  NO_ARREAR_EXTRAS,
  type ArrearExtras,
} from '@/components/salary/salary-arrears-bill';
import { missingSelectClass } from '@/components/salary/salary-arrears-dialog';
import { SalaryBulkRequestDialog } from '@/components/salary/salary-bill-access';
import { TrForm15Staff, type TrStaffEntry, type TrStaffOfficeGroup } from '@/components/salary/tr-form-15';
import { STAMP_DUTY, type TrSignatory } from '@/components/salary/tr-form-parts';
import { SalaryJoiningDateField } from '@/components/salary/salary-joining-date';
import {
  EMPTY_EXCEPTIONAL_DRAFT,
  SalaryExceptionalIssuesField,
  exceptionalFromIssues,
  exceptionalToStaffDto,
  type ExceptionalDraft,
} from '@/components/salary/salary-exceptional-issues';
import { ApiError, apiFetch } from '@/lib/api-client';
import { preparedStampBn } from '@/lib/bangla-format';
import { downloadFormPdf, pdfFileName } from '@/lib/salary-pdf';
import { HRA_AREAS, hraAreaText, localNum, salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';

const selectClass =
  'flex h-10 w-full rounded-md border border-amber-300 bg-white px-3 text-sm font-medium focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100';

type StaffDetails = Omit<SalaryStaffDto, 'staff_office_id'>;

interface StaffForm {
  name: string;
  post: string;
  nid: string;
  grade: PayGrade | null;
  oldPay: number;
  housingStatus: HousingStatus;
  /** '' until chosen; required for house rent. */
  hraArea: HraArea | '';
  extras: ArrearExtras;
  joiningDate: string;
  exceptional: ExceptionalDraft;
}

const EMPTY_FORM: StaffForm = {
  name: '',
  post: '',
  nid: '',
  grade: null,
  oldPay: 0,
  housingStatus: 'hra_eligible',
  hraArea: '',
  extras: NO_ARREAR_EXTRAS,
  joiningDate: '',
  exceptional: EMPTY_EXCEPTIONAL_DRAFT,
};

function nextStage(grade: PayGrade, oldPay: number, joiningDate: string | null): number {
  if (isIncrementWithheld(grade, oldPay, joiningDate)) return oldPay;
  const scale = NPS_2015[grade];
  const i = scale.indexOf(oldPay);
  return i >= 0 && i < scale.length - 1 ? scale[i + 1]! : oldPay;
}

function toForm(s: SalaryStaffRecord): StaffForm {
  return {
    name: s.name,
    post: s.post,
    nid: s.nid,
    grade: s.grade as PayGrade,
    oldPay: s.old_pay,
    housingStatus: s.housing_status,
    hraArea: s.hra_area,
    extras: { excess_rr: Boolean(s.excess_rr), excess_puja: Boolean(s.excess_puja) },
    joiningDate: s.joining_date ?? '',
    exceptional: exceptionalFromIssues(s.exceptional),
  };
}

function StaffDialog({
  locale,
  initial,
  editing,
  onCancel,
  onSave,
}: {
  locale: SalaryLocale;
  initial: StaffForm;
  editing: boolean;
  onCancel: () => void;
  /** Resolves to an error message to keep the dialog open, or null when saved. */
  onSave: (dto: StaffDetails) => Promise<string | null>;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const [v, setV] = useState<StaffForm>(initial);
  const [error, setError] = useState('');
  const [hraMissing, setHraMissing] = useState(false);
  const [saving, setSaving] = useState(false);
  const askJoining = v.grade != null && asksJoiningDate(v.grade, v.oldPay);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = v.name.trim();
    const post = v.post.trim();
    const nid = v.nid.trim();
    if (name.length < 2) return setError(t.staffNameRequired);
    if (post.length < 2) return setError(t.staffPostRequired);
    if (!v.grade) return setError(t.gradeRequired);
    if (!NPS_2015[v.grade].includes(v.oldPay)) return setError(t.basicRequired);
    if (askJoining && !isIsoDate(v.joiningDate)) return setError(t.joiningDateRequired);
    if (v.housingStatus === 'hra_eligible' && !v.hraArea) {
      setHraMissing(true);
      document.getElementById('staff-hra-area')?.focus();
      return setError(t.hraAreaRequired);
    }
    setSaving(true);
    setError('');
    const message = await onSave({
      name,
      post,
      nid,
      grade: v.grade,
      old_pay: v.oldPay,
      housing_status: v.housingStatus,
      hra_area: v.hraArea || 'other',
      ...v.extras,
      joining_date: askJoining ? v.joiningDate : null,
      exceptional: exceptionalToStaffDto(v.exceptional),
    });
    setSaving(false);
    if (message) setError(message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <form onSubmit={submit} className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Users className="h-5 w-5 text-amber-700" />
            {editing ? t.staffEditTitle : t.staffAddTitle}
          </h2>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <p className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t.staffSavedNote}</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="staff-name" className="font-bold">
                {t.staffName}
                <span className="text-destructive"> *</span>
              </Label>
              <Input
                id="staff-name"
                value={v.name}
                maxLength={120}
                autoFocus
                onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-post" className="font-bold">
                {t.staffPost}
                <span className="text-destructive"> *</span>
              </Label>
              <Input
                id="staff-post"
                value={v.post}
                maxLength={120}
                onChange={(e) => setV((p) => ({ ...p, post: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="staff-grade" className="font-bold">{t.grade}</Label>
              <select
                id="staff-grade"
                className={selectClass}
                value={v.grade ?? ''}
                onChange={(e) => {
                  const g = e.target.value === '' ? null : (Number(e.target.value) as PayGrade);
                  setV((p) => ({
                    ...p,
                    grade: g,
                    oldPay: g && NPS_2015[g].includes(p.oldPay) ? p.oldPay : 0,
                    exceptional: EMPTY_EXCEPTIONAL_DRAFT,
                  }));
                }}
              >
                <option value="">{t.gradePlaceholder}</option>
                {PAY_GRADES.map((g) => (
                  <option key={g} value={g}>
                    {`${t.grade} ${num(g)}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="staff-basic" className="font-bold">{t.basicJune}</Label>
              <select
                id="staff-basic"
                className={`${selectClass} tabular-nums`}
                disabled={!v.grade}
                value={v.oldPay > 0 ? v.oldPay : ''}
                onChange={(e) => setV((p) => ({ ...p, oldPay: Number(e.target.value) || 0 }))}
              >
                <option value="">{v.grade ? t.basicPlaceholder : t.gradeFirst}</option>
                {v.grade
                  ? NPS_2015[v.grade].map((amount, i) => (
                      <option key={amount} value={amount}>
                        {`${num(formatTaka(amount))} — ${t.stepOption(num(i + 1))}${i === 0 ? ` (${t.initialBasic})` : ''}`}
                      </option>
                    ))
                  : null}
              </select>
            </div>
          </div>
          {askJoining ? (
            <SalaryJoiningDateField
              locale={locale}
              id="staff-joining-date"
              value={v.joiningDate}
              onChange={(joiningDate) => setV((p) => ({ ...p, joiningDate }))}
            />
          ) : null}
          <SalaryExceptionalIssuesField
            locale={locale}
            value={v.exceptional}
            onChange={(exceptional) => setV((p) => ({ ...p, exceptional }))}
          />
          <fieldset className="space-y-2">
            <legend className="text-sm font-bold text-slate-800">{t.housing}</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="staff-housing"
                className="mt-1"
                checked={v.housingStatus === 'hra_eligible'}
                onChange={() => setV((p) => ({ ...p, housingStatus: 'hra_eligible' }))}
              />
              <span>{t.hraEligible}</span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm">
              <input
                type="radio"
                name="staff-housing"
                className="mt-1"
                checked={v.housingStatus === 'govt_accommodation'}
                onChange={() => setV((p) => ({ ...p, housingStatus: 'govt_accommodation' }))}
              />
              <span>{t.govtAccommodation}</span>
            </label>
          </fieldset>
          {v.housingStatus === 'hra_eligible' ? (
            <div className="space-y-1.5">
              <Label htmlFor="staff-hra-area" className="font-bold">{t.hraArea}</Label>
              <select
                id="staff-hra-area"
                aria-invalid={hraMissing && !v.hraArea}
                className={hraMissing && !v.hraArea ? missingSelectClass : selectClass}
                value={v.hraArea}
                onChange={(e) => {
                  setHraMissing(false);
                  setV((p) => ({ ...p, hraArea: e.target.value as HraArea }));
                }}
              >
                <option value="" disabled>
                  {t.hraAreaPlaceholder}
                </option>
                {HRA_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {hraAreaText(locale, a)}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <p className="rounded-md border border-border bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700">
            {t.staffSpecialNote}
          </p>
          {v.grade && v.oldPay > 0 ? (
            <ArrearExtraDeductions
              locale={locale}
              oldPay={v.oldPay}
              nextStep={nextStage(v.grade, v.oldPay, askJoining ? v.joiningDate : null)}
              value={v.extras}
              onChange={(extras) => setV((p) => ({ ...p, extras }))}
            />
          ) : null}
          {error ? <Alert variant="error">{error}</Alert> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" className="gap-2 bg-amber-600 hover:bg-amber-700" disabled={saving}>
            {saving ? t.staffSaving : editing ? t.staffUpdate : t.staffSave}
          </Button>
        </div>
      </form>
    </div>
  );
}

interface StaffSignInput {
  enabled: boolean;
  name: string;
  post: string;
}

function OfficeDialog({
  locale,
  initial,
  locked,
  sign,
  consolidated,
  onCancel,
  onConfirm,
}: {
  locale: SalaryLocale;
  initial: string;
  locked: boolean;
  sign: StaffSignInput;
  consolidated?: boolean;
  onCancel: () => void;
  onConfirm: (office: string, sign: StaffSignInput) => void;
}) {
  const t = salaryCopy(locale);
  const [office, setOffice] = useState(initial);
  const [s, setS] = useState<StaffSignInput>(sign);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(office.trim(), { enabled: s.enabled, name: s.name.trim(), post: s.post.trim() });
        }}
        className="relative max-h-[92vh] w-full max-w-md overflow-y-auto rounded-2xl bg-surface shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Download className="h-5 w-5 text-amber-700" />
              {consolidated ? t.staffOfficeTitleConsol : t.staffOfficeTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">{consolidated ? t.staffOfficeHintConsol : t.staffOfficeHint}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-1.5 p-5">
          <Label htmlFor="staff-office" className="font-bold">{t.officeName}</Label>
          <Input
            id="staff-office"
            value={office}
            onChange={(e) => setOffice(e.target.value)}
            readOnly={locked}
            autoFocus={!locked}
            className={locked ? 'cursor-not-allowed bg-slate-100' : undefined}
          />
          {locked ? <p className="text-xs text-muted">{t.officeFixedOnBill}</p> : null}
        </div>
        <div className="space-y-3 px-5 pb-5">
          <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded"
              checked={s.enabled}
              onChange={(e) => setS((p) => ({ ...p, enabled: e.target.checked }))}
            />
            <span>
              <span className="block font-medium">{t.signAdd}</span>
              <span className="block text-xs text-muted">{t.signStaffHint}</span>
            </span>
          </label>
          {s.enabled ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="staff-sign-name" className="font-bold">{t.signName}</Label>
                <Input
                  id="staff-sign-name"
                  value={s.name}
                  maxLength={120}
                  autoComplete="name"
                  onChange={(e) => setS((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-sign-post" className="font-bold">{t.signPost}</Label>
                <Input
                  id="staff-sign-post"
                  value={s.post}
                  maxLength={120}
                  autoComplete="organization-title"
                  onChange={(e) => setS((p) => ({ ...p, post: e.target.value }))}
                />
              </div>
            </div>
          ) : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button type="submit" className="gap-2 bg-amber-600 hover:bg-amber-700">
            <Download className="h-4 w-4" />
            {t.downloadNow}
          </Button>
        </div>
      </form>
    </div>
  );
}

function StaffOfficeDialog({
  locale,
  initial,
  onCancel,
  onSave,
}: {
  locale: SalaryLocale;
  initial: SalaryStaffOfficeRecord | null;
  onCancel: () => void;
  /** Resolves to an error message to keep the dialog open, or null when saved. */
  onSave: (name: string) => Promise<string | null>;
}) {
  const t = salaryCopy(locale);
  const [name, setName] = useState(initial?.name ?? '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = name.trim();
    if (value.length < 3) return setError(t.staffOfficeNameRequired);
    setSaving(true);
    setError('');
    const message = await onSave(value);
    setSaving(false);
    if (message?.trim()) setError(message);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <form onSubmit={submit} className="relative w-full max-w-md rounded-2xl bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Building2 className="h-5 w-5 text-amber-700" />
              {initial ? t.staffOfficeRenameTitle : t.staffAddOffice}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.staffOfficeAddHint}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-1.5 p-5">
          <Label htmlFor="staff-office-name" className="font-bold">{t.officeName}</Label>
          <Input
            id="staff-office-name"
            value={name}
            maxLength={200}
            autoFocus
            placeholder={t.officeOtherPlaceholderBn}
            onChange={(e) => setName(e.target.value)}
          />
          {error ? <Alert variant="error">{error}</Alert> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" className="gap-2 bg-amber-600 hover:bg-amber-700" disabled={saving}>
            {saving ? t.staffSaving : initial ? t.staffUpdate : t.staffSave}
          </Button>
        </div>
      </form>
    </div>
  );
}

function StaffConfirmDialog({
  locale,
  office,
  rows,
  onEdit,
  onEditOne,
  onConfirm,
}: {
  locale: SalaryLocale;
  office: string;
  rows: Array<{ staff: SalaryStaffRecord; result: SalaryArrearResult }>;
  onEdit: () => void;
  onEditOne: (s: SalaryStaffRecord) => void;
  onConfirm: () => void;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const amt = (n: number) => (n < 0 ? `− ${num(formatTaka(-n))}` : num(formatTaka(n)));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onEdit} />
      <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col rounded-2xl bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ShieldCheck className="h-5 w-5 text-amber-700" />
              {t.staffConfirmTitle}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-800">{office}</p>
            <p className="mt-1 text-sm text-muted">{t.staffConfirmHint}</p>
          </div>
          <button type="button" onClick={onEdit} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-auto p-4">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-2 py-2 font-semibold">#</th>
                <th className="px-2 py-2 font-semibold">{t.staffColEmployee}</th>
                <th className="px-2 py-2 font-semibold">{t.grade}</th>
                <th className="px-2 py-2 text-right font-semibold">{t.staffColBasic}</th>
                <th className="px-2 py-2 font-semibold">{t.staffColHousing}</th>
                <th className="px-2 py-2 font-semibold">{t.staffColJoining}</th>
                <th className="px-2 py-2 text-right font-semibold">{t.staffColNet}</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ staff: s, result }, i) => (
                <tr key={s.id} className="border-t border-border align-top">
                  <td className="px-2 py-2 text-muted">{num(i + 1)}</td>
                  <td className="px-2 py-2">
                    <div className="font-semibold text-slate-900">{s.name}</div>
                    <div className="text-xs text-muted">{s.post}</div>
                  </td>
                  <td className="px-2 py-2">{num(s.grade)}</td>
                  <td className="px-2 py-2 text-right font-mono">{num(formatTaka(s.old_pay))}</td>
                  <td className="px-2 py-2 text-xs">
                    {s.housing_status === 'hra_eligible' ? hraAreaText(locale, s.hra_area) : t.govtHousing}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {s.joining_date ? num(s.joining_date.split('-').reverse().join('-')) : '—'}
                  </td>
                  <td className="px-2 py-2 text-right font-mono font-semibold">{amt(result.total_net_arrear)}</td>
                  <td className="px-2 py-2 text-right">
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => onEditOne(s)}>
                      <Pencil className="h-3.5 w-3.5" />
                      {t.staffEdit}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" className="gap-1.5" onClick={onEdit}>
            <Pencil className="h-4 w-4" />
            {t.staffConfirmEdit}
          </Button>
          <Button type="button" className="gap-2 bg-amber-600 hover:bg-amber-700" onClick={onConfirm}>
            <Download className="h-4 w-4" />
            {t.staffConfirmOk}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ConsolOfficeDialog({
  locale,
  options,
  onCancel,
  onConfirm,
}: {
  locale: SalaryLocale;
  options: Array<{ id: string | null; name: string; count: number }>;
  onCancel: () => void;
  onConfirm: (ids: Array<string | null>) => void;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const withStaff = options.filter((o) => o.count > 0);
  const [checked, setChecked] = useState<Set<string>>(() => new Set(withStaff.map((o) => o.id ?? 'own')));
  const [error, setError] = useState('');

  function keyOf(id: string | null) {
    return id ?? 'own';
  }

  function toggle(id: string | null) {
    const k = keyOf(id);
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Download className="h-5 w-5 text-amber-700" />
              {t.staffConsolTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.staffConsolHint}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setChecked(new Set(withStaff.map((o) => keyOf(o.id))))}
            >
              {t.staffConsolSelectAll}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setChecked(new Set())}>
              {t.staffConsolClear}
            </Button>
          </div>
          <ul className="space-y-2">
            {options.map((o) => {
              const k = keyOf(o.id);
              const disabled = o.count === 0;
              return (
                <li key={k}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${
                      disabled ? 'cursor-not-allowed border-border bg-slate-50 opacity-60' : 'border-amber-200 bg-amber-50/50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 h-4 w-4 rounded"
                      checked={checked.has(k)}
                      disabled={disabled}
                      onChange={() => toggle(o.id)}
                    />
                    <span>
                      <span className="block font-semibold text-slate-900">{o.name}</span>
                      <span className="block text-xs text-muted">{t.staffOfficeCount(num(o.count))}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          {error ? <Alert variant="error">{error}</Alert> : null}
        </div>
        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            {t.cancel}
          </Button>
          <Button
            type="button"
            className="gap-2 bg-amber-600 hover:bg-amber-700"
            onClick={() => {
              const ids = options.filter((o) => checked.has(keyOf(o.id)) && o.count > 0).map((o) => o.id);
              if (ids.length === 0) return setError(t.staffConsolNeedOne);
              onConfirm(ids);
            }}
          >
            <Download className="h-4 w-4" />
            {t.staffConfirmOk}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Office staff arrear bill: saved employee details, live arrears table and one T.R. Form 15 for all. */
export function SalaryStaffBill({
  locale,
  months,
  onMonthsChange,
  access,
  onAccessChange,
  officeLabel,
  officeLocked,
  accessPanel,
  contactsPanel,
}: {
  locale: SalaryLocale;
  months: string[];
  onMonthsChange: (months: string[]) => void;
  access: SalaryBillAccessRecord | null;
  onAccessChange: (access: SalaryBillAccessRecord) => void;
  officeLabel: string;
  /** The office name comes from the user's "Others" office and cannot be edited on the form. */
  officeLocked: boolean;
  accessPanel: React.ReactNode;
  contactsPanel: React.ReactNode;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const amt = (n: number) => num(formatTaka(n));
  const signed = (n: number) => (n < 0 ? `− ${amt(-n)}` : amt(n));

  const [allStaff, setAllStaff] = useState<SalaryStaffRecord[] | null>(null);
  const [offices, setOffices] = useState<SalaryStaffOfficeRecord[]>([]);
  const [activeOffice, setActiveOffice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [dialog, setDialog] = useState<{ editing: SalaryStaffRecord | null } | null>(null);
  const [officeEdit, setOfficeEdit] = useState<{ editing: SalaryStaffOfficeRecord | null } | null>(null);
  const [officeDialog, setOfficeDialog] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [consolPick, setConsolPick] = useState(false);
  const [consolIds, setConsolIds] = useState<Array<string | null> | null>(null);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [sign, setSign] = useState<StaffSignInput>({ enabled: true, name: '', post: '' });
  const [deductStamp, setDeductStamp] = useState(true);
  const [capture, setCapture] = useState<{
    office: string;
    entries: TrStaffEntry[];
    groups?: TrStaffOfficeGroup[];
    signatory: TrSignatory | null;
    preparedOn: string;
  } | null>(null);
  const paidFor = useRef<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoadError(false);
    try {
      const [staffRes, officesRes] = await Promise.all([
        apiFetch<{ data: SalaryStaffRecord[] }>('/salary/staff'),
        apiFetch<{ data: SalaryStaffOfficeRecord[] }>('/salary/staff/offices'),
      ]);
      setAllStaff(staffRes.data);
      setOffices(officesRes.data);
      setActiveOffice((prev) => (prev && officesRes.data.some((o) => o.id === prev) ? prev : null));
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const activeOfficeRec = offices.find((o) => o.id === activeOffice) ?? null;
  const activeStaff = useMemo(() => allStaff?.filter((s) => !s.trashed) ?? null, [allStaff]);
  const staff = useMemo(
    () => activeStaff?.filter((s) => (s.staff_office_id ?? null) === activeOffice) ?? null,
    [activeStaff, activeOffice],
  );
  const staffIn = (officeId: string | null) =>
    activeStaff?.filter((s) => (s.staff_office_id ?? null) === officeId).length ?? 0;
  const officeTabs = useMemo(
    () => [
      { id: null as string | null, name: officeLabel || t.staffOwnOffice, own: true },
      ...offices.map((o) => ({ id: o.id as string | null, name: o.name, own: false })),
    ],
    [officeLabel, offices, t.staffOwnOffice],
  );
  /** Own office plus at least one added staff-bill office. */
  const multiOffice = offices.length > 0;

  const rows = useMemo(() => {
    if (!staff || months.length === 0) return null;
    return staff.map((s) => {
      let result: SalaryArrearResult | null = null;
      try {
        result = calculateStaffArrears(s, months);
      } catch {
        result = null;
      }
      return { staff: s, result };
    });
  }, [staff, months]);

  const valid = rows?.filter((r): r is { staff: SalaryStaffRecord; result: SalaryArrearResult } => r.result != null) ?? [];
  const count = staff?.length ?? 0;
  const totalArrears = valid.reduce((s, r) => s + r.result.total_basic_difference + r.result.total_hra_protection, 0);
  const totalDeduction = valid.reduce((s, r) => s + r.result.total_deduction, 0);
  const totalNet = valid.reduce((s, r) => s + r.result.total_net_arrear, 0);
  const stampEach = deductStamp ? STAMP_DUTY : 0;
  const stamp = stampEach * valid.length;
  const remaining = access?.remaining ?? 0;
  const unlimited = Boolean(access?.unlimited);
  const canAddEmployee = unlimited || remaining > 0 || Boolean(access && access.bill_limit <= 0 && access.can_calculate);

  async function save(details: StaffDetails): Promise<string | null> {
    const editing = dialog?.editing;
    if (editing && salaryStaffNameChangeTooLarge(editing.name, details.name)) {
      return t.staffNameTooDifferent;
    }
    if (!editing && access && !access.unlimited && access.bill_limit > 0 && remaining <= 0) {
      return t.staffAddLimit(num(remaining));
    }
    const dto: SalaryStaffDto = { ...details, staff_office_id: editing ? (editing.staff_office_id ?? null) : activeOffice };
    try {
      if (editing) {
        const res = await apiFetch<{ data: SalaryStaffRecord }>(`/salary/staff/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(dto),
        });
        setAllStaff((prev) => (prev ?? []).map((s) => (s.id === editing.id ? res.data : s)));
      } else {
        const res = await apiFetch<{ data: SalaryStaffRecord }>('/salary/staff', {
          method: 'POST',
          body: JSON.stringify(dto),
        });
        setAllStaff((prev) => [...(prev ?? []), res.data]);
      }
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === SALARY_CALC_LIMIT_CODE || err.code === SALARY_BILL_LIMIT_CODE)
      ) {
        setDialog(null);
        void refreshAccess().then(() => {
          setBulkMessage(err.message);
          setBulkDialog(true);
        });
        return null;
      }
      return err instanceof Error ? err.message : t.calcError;
    }
    setDialog(null);
    void refreshAccess();
    return null;
  }

  async function refreshAccess() {
    try {
      const res = await apiFetch<{ data: SalaryBillAccessRecord }>('/salary/access');
      onAccessChange(res.data);
    } catch {
      /* the next action reloads access */
    }
  }

  async function trash(s: SalaryStaffRecord) {
    if (!window.confirm(t.staffTrashConfirm(s.name))) return;
    setError('');
    try {
      await apiFetch(`/salary/staff/${s.id}`, { method: 'DELETE' });
      setAllStaff((prev) => (prev ?? []).map((x) => (x.id === s.id ? { ...x, trashed: true } : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.calcError);
    }
  }

  async function saveOffice(name: string): Promise<string | null> {
    const editing = officeEdit?.editing;
    if (!editing && !window.confirm(t.staffOfficeSpellConfirm(name))) {
      return ' ';
    }
    try {
      if (editing) {
        const res = await apiFetch<{ data: SalaryStaffOfficeRecord }>(`/salary/staff/offices/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify({ name }),
        });
        setOffices((prev) => prev.map((o) => (o.id === editing.id ? res.data : o)));
      } else {
        const res = await apiFetch<{ data: SalaryStaffOfficeRecord }>('/salary/staff/offices', {
          method: 'POST',
          body: JSON.stringify({ name }),
        });
        setOffices((prev) => [...prev, res.data]);
        setActiveOffice(res.data.id);
      }
    } catch (err) {
      return err instanceof Error ? err.message : t.calcError;
    }
    setOfficeEdit(null);
    return null;
  }

  const billKey = (officeIds: Array<string | null>, list: SalaryStaffRecord[]) =>
    JSON.stringify({
      offices: [...officeIds].map((id) => id ?? 'own').sort(),
      months: [...months].sort(),
      staff: list.map((s) => [s.id, s.updated_at]),
    });

  function startDownload() {
    setError('');
    setConsolIds(null);
    if (!access) return;
    setConfirmOpen(true);
  }

  function startConsol() {
    setError('');
    setConsolPick(true);
  }

  function rowsForOffices(ids: Array<string | null>) {
    if (!activeStaff || months.length === 0) return [];
    return ids.flatMap((officeId) => {
      const list = activeStaff.filter((s) => (s.staff_office_id ?? null) === officeId);
      return list.map((s) => {
        try {
          return { staff: s, result: calculateStaffArrears(s, months), officeId };
        } catch {
          return null;
        }
      });
    }).filter((r): r is { staff: SalaryStaffRecord; result: SalaryArrearResult; officeId: string | null } => r != null);
  }

  async function confirmDownload(office: string, nextSign: StaffSignInput) {
    setOfficeDialog(false);
    setSign(nextSign);
    const officeIds = consolIds ?? [activeOffice];
    const consol = consolIds != null;
    const picked = consol ? rowsForOffices(officeIds) : valid.map((r) => ({ ...r, officeId: activeOffice }));
    if (picked.length === 0) return;
    if (!consol && (!staff || valid.length !== staff.length)) return;
    const list = picked.map((r) => r.staff);
    const key = billKey(officeIds, list);
    setDownloading(true);
    setError('');
    if (paidFor.current !== key) {
      try {
        const body =
          consol
            ? { months, staff_office_ids: officeIds }
            : { months, staff_office_id: activeOffice };
        const res = await apiFetch<{ data: SalaryBillAccessRecord }>('/salary/staff/bill', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        onAccessChange(res.data);
        paidFor.current = key;
      } catch (err) {
        setDownloading(false);
        setError(err instanceof Error ? err.message : t.calcError);
        if (err instanceof ApiError && err.code === SALARY_BILL_LIMIT_CODE) {
          void apiFetch<{ data: SalaryBillAccessRecord }>('/salary/access')
            .then((res) => {
              onAccessChange(res.data);
              setBulkMessage('');
              setBulkDialog(true);
            })
            .catch(() => {});
        }
        return;
      }
    }
    const entries: TrStaffEntry[] = picked.map((r) => ({
      id: r.staff.id,
      name: r.staff.name,
      post: r.staff.post,
      nid: '',
      hraArea: r.staff.hra_area,
      result: r.result,
    }));
    const groups: TrStaffOfficeGroup[] | undefined = consol
      ? officeIds.map((id) => {
          const groupName =
            id == null ? officeLabel || t.staffOwnOffice : offices.find((o) => o.id === id)?.name ?? t.staffOwnOffice;
          const staffEntries = picked
            .filter((r) => r.officeId === id)
            .map((r) => ({
              id: r.staff.id,
              name: r.staff.name,
              post: r.staff.post,
              nid: '',
              hraArea: r.staff.hra_area,
              result: r.result,
            }));
          return { groupName, staff: staffEntries };
        }).filter((g) => g.staff.length > 0)
      : undefined;
    setCapture({
      office,
      groups,
      signatory: nextSign.enabled ? { name: nextSign.name, post: nextSign.post, office } : null,
      entries,
      preparedOn: preparedStampBn(),
    });
    setConsolIds(null);
  }

  useEffect(() => {
    if (!capture) return;
    let cancelled = false;
    void (async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const root = formRef.current;
      try {
        if (!root) throw new Error('Form not ready');
        await downloadFormPdf(
          root,
          pdfFileName('TR Form 15', 'Office Staff Arrears', capture.office, `${capture.entries.length} staff`),
        );
      } catch {
        if (!cancelled) setError(t.staffPdfFailed);
      } finally {
        if (!cancelled) {
          setCapture(null);
          setDownloading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [capture, t]);

  return (
    <Card className="overflow-hidden border border-amber-300 shadow-sm">
      <div className="bg-amber-600 px-4 py-2.5 text-white sm:px-5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Users className="h-4 w-4" />
          {t.staffTitle}
        </div>
        <p className="mt-0.5 text-xs text-amber-50/90">{t.staffHint}</p>
      </div>
      <CardContent className="space-y-4 p-4 sm:p-5">
        <ArrearMonthPicker locale={locale} months={months} onMonthsChange={onMonthsChange} />
        {months.length === 0 ? <Alert variant="error">{t.arrSelectMonth}</Alert> : null}

        <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-950">
              <Building2 className="h-4 w-4" />
              {t.staffOfficesLabel}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOfficeEdit({ editing: null })}
              className="gap-1.5 border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.staffAddOffice}
            </Button>
          </div>
          {offices.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="tablist">
              {officeTabs.map((o) => {
                const active = o.id === activeOffice;
                return (
                  <button
                    key={o.id ?? 'own'}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveOffice(o.id);
                      setError('');
                    }}
                    className={`max-w-full rounded-lg border px-3 py-1.5 text-left text-xs font-semibold ${
                      active ? 'border-amber-600 bg-amber-600 text-white' : 'border-amber-300 bg-white text-amber-950 hover:bg-amber-100'
                    }`}
                  >
                    <span className="block truncate">{o.name}</span>
                    <span className={`block text-[11px] font-medium ${active ? 'text-amber-50' : 'text-amber-800'}`}>
                      {o.own ? `${t.staffOwnOfficeTag} · ` : ''}
                      {t.staffOfficeCount(num(staffIn(o.id)))}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : null}
          {activeOfficeRec && unlimited ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setOfficeEdit({ editing: activeOfficeRec })}>
                <Pencil className="h-3.5 w-3.5" />
                {t.staffOfficeRename}
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-amber-900">{t.staffOfficesHint}</p>
          {unlimited ? null : <p className="text-xs font-semibold text-[#b71c1c]">{t.staffOfficeAdminOnly}</p>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">
            {t.staffColEmployee}: {num(count)}
          </p>
          <Button
            type="button"
            onClick={() => {
              if (!canAddEmployee && access && !unlimited && access.bill_limit > 0) {
                setBulkMessage(t.staffAddLimit(num(remaining)));
                setBulkDialog(true);
                return;
              }
              setDialog({ editing: null });
            }}
            className="gap-2 bg-amber-600 hover:bg-amber-700"
          >
            <Plus className="h-4 w-4" />
            {t.staffAdd}
          </Button>
        </div>
        {!unlimited && access && access.bill_limit > 0 ? (
          <p className={`text-xs font-semibold ${remaining > 0 ? 'text-amber-900' : 'text-rose-700'}`}>
            {t.staffAddUsesBill(num(remaining))}
          </p>
        ) : null}

        {loadError ? (
          <Alert variant="error">
            {t.staffLoadError}{' '}
            <button type="button" className="font-semibold underline" onClick={() => void load()}>
              {t.retry}
            </button>
          </Alert>
        ) : staff === null ? (
          <p className="text-sm text-muted">
            <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
          </p>
        ) : staff.length === 0 ? (
          <p className="rounded-lg border border-dashed border-amber-300 bg-amber-50/60 px-3 py-4 text-center text-sm text-amber-900">
            {t.staffEmpty}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">{t.staffColEmployee}</th>
                  <th className="px-3 py-2 font-semibold">{t.grade}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t.staffColBasic}</th>
                  <th className="px-3 py-2 font-semibold">{t.staffColHousing}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t.staffColTotal}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t.staffColDeduction}</th>
                  <th className="px-3 py-2 text-right font-semibold">{t.staffColNet}</th>
                  <th className="px-3 py-2 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {staff.map((s, i) => {
                  const r = rows?.[i]?.result ?? null;
                  return (
                    <tr key={s.id} className="border-t border-border align-top">
                      <td className="px-3 py-2 text-muted">{num(i + 1)}</td>
                      <td className="px-3 py-2">
                        <div className="font-semibold text-slate-900">{s.name}</div>
                        <div className="text-xs text-muted">{s.post}</div>
                        {r && (r.excess_rr > 0 || r.excess_puja > 0) ? (
                          <div className="mt-0.5 text-xs font-medium text-rose-700">
                            {[
                              r.excess_rr > 0 ? `${t.arrExcessRrShort} − ${amt(r.excess_rr)}` : '',
                              r.excess_puja > 0 ? `${t.arrExcessPujaShort} − ${amt(r.excess_puja)}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">{num(s.grade)}</td>
                      <td className="px-3 py-2 text-right font-mono">{amt(s.old_pay)}</td>
                      <td className="px-3 py-2 text-xs">
                        {s.housing_status === 'hra_eligible' ? hraAreaText(locale, s.hra_area) : t.govtHousing}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {r ? signed(r.total_basic_difference + r.total_hra_protection) : '—'}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-rose-700">{r ? `− ${amt(r.total_deduction)}` : '—'}</td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">{r ? signed(r.total_net_arrear) : '—'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mr-1 gap-1"
                          onClick={() => setDialog({ editing: s })}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          {t.staffEdit}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                          onClick={() => void trash(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t.staffTrash}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {valid.length > 0 ? (
                  <>
                    <tr className="border-t-2 border-amber-200 bg-amber-50 font-semibold">
                      <td className="px-3 py-2.5 text-amber-950" colSpan={5}>
                        {t.staffTotalRow(num(valid.length))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono">{signed(totalArrears)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-rose-700">− {amt(totalDeduction)}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-base font-bold text-amber-950">{signed(totalNet)}</td>
                      <td />
                    </tr>
                    <tr className="border-t border-border">
                      <td className="px-3 py-2" colSpan={7}>
                        <label className="inline-flex cursor-pointer items-start gap-2">
                          <input
                            type="checkbox"
                            className="mt-0.5 h-4 w-4 shrink-0 accent-amber-700 print:hidden"
                            checked={deductStamp}
                            onChange={(e) => setDeductStamp(e.target.checked)}
                          />
                          <span>
                            <span className="block font-semibold">{deductStamp ? t.staffStamp(num(valid.length)) : t.stampDeduct}</span>
                            <span className="block text-xs font-normal text-muted print:hidden">{t.stampDeductHint}</span>
                          </span>
                        </label>
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-rose-700">{stamp > 0 ? `− ${amt(stamp)}` : '—'}</td>
                      <td />
                    </tr>
                    <tr className="border-t-2 border-amber-300 bg-amber-100/70 font-bold">
                      <td className="px-3 py-2.5 text-amber-950" colSpan={7}>
                        {stamp > 0 ? t.staffPayable : t.staffPayableOpen}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-lg text-amber-950">৳ {signed(totalNet - stamp)}</td>
                      <td />
                    </tr>
                  </>
                ) : null}
              </tbody>
            </table>
          </div>
        )}

        {error ? <Alert variant="error">{error}</Alert> : null}

        {months.length > 0 && (count > 0 || (multiOffice && (activeStaff?.length ?? 0) > 0)) ? (
          <div className="space-y-2 text-center print:hidden">
            <div className="flex flex-wrap items-center justify-center gap-2">
              {count > 0 ? (
                <Button
                  type="button"
                  size="lg"
                  onClick={startDownload}
                  disabled={downloading || valid.length !== count || !access}
                  className="gap-2 bg-amber-600 px-8 hover:bg-amber-700"
                >
                  {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  {downloading ? t.downloading : t.staffDownload(String(count))}
                </Button>
              ) : null}
              {multiOffice ? (
                <Button
                  type="button"
                  size="lg"
                  variant="outline"
                  onClick={startConsol}
                  disabled={downloading || !access || (activeStaff?.length ?? 0) === 0}
                  className="gap-2 border-amber-500 bg-white px-6 text-amber-950 hover:bg-amber-50"
                >
                  <Download className="h-4 w-4" />
                  {t.staffConsolBtn}
                </Button>
              ) : null}
            </div>
            {!unlimited ? <p className="text-xs font-semibold text-amber-900">{t.staffPrintFree}</p> : null}
          </div>
        ) : null}

        {accessPanel}
        {contactsPanel}
      </CardContent>

      {dialog ? (
        <StaffDialog
          locale={locale}
          initial={dialog.editing ? toForm(dialog.editing) : EMPTY_FORM}
          editing={Boolean(dialog.editing)}
          onCancel={() => setDialog(null)}
          onSave={save}
        />
      ) : null}

      {confirmOpen && staff && valid.length === staff.length ? (
        <StaffConfirmDialog
          locale={locale}
          office={activeOfficeRec ? activeOfficeRec.name : officeLabel || t.staffOwnOffice}
          rows={valid}
          onEdit={() => setConfirmOpen(false)}
          onEditOne={(s) => {
            setConfirmOpen(false);
            setDialog({ editing: s });
          }}
          onConfirm={() => {
            setConfirmOpen(false);
            setOfficeDialog(true);
          }}
        />
      ) : null}

      {consolPick ? (
        <ConsolOfficeDialog
          locale={locale}
          options={officeTabs.map((o) => ({ id: o.id, name: o.name, count: staffIn(o.id) }))}
          onCancel={() => setConsolPick(false)}
          onConfirm={(ids) => {
            setConsolPick(false);
            const picked = rowsForOffices(ids);
            if (picked.length === 0) {
              setError(t.staffConsolNeedOne);
              return;
            }
            setConsolIds(ids);
            setOfficeDialog(true);
          }}
        />
      ) : null}

      {officeDialog ? (
        <OfficeDialog
          locale={locale}
          initial={
            consolIds
              ? officeLabel
              : activeOfficeRec
                ? activeOfficeRec.name
                : officeLabel
          }
          locked={!consolIds && !activeOfficeRec && officeLocked}
          consolidated={Boolean(consolIds)}
          sign={sign}
          onCancel={() => {
            setOfficeDialog(false);
            setConsolIds(null);
          }}
          onConfirm={(office, nextSign) => {
            const lockedOwn = !consolIds && !activeOfficeRec && officeLocked;
            void confirmDownload(lockedOwn ? officeLabel : office, nextSign);
          }}
        />
      ) : null}

      {officeEdit ? (
        <StaffOfficeDialog
          locale={locale}
          initial={officeEdit.editing}
          onCancel={() => setOfficeEdit(null)}
          onSave={saveOffice}
        />
      ) : null}

      {bulkDialog && access ? (
        <SalaryBulkRequestDialog
          locale={locale}
          access={access}
          message={bulkMessage || (access.remaining <= 0 ? t.staffAddLimit(num(remaining)) : undefined)}
          onAccessChange={onAccessChange}
          onClose={() => setBulkDialog(false)}
        />
      ) : null}

      {capture ? (
        <TrForm15Staff
          ref={formRef}
          staff={capture.entries}
          groups={capture.groups}
          months={months}
          office={capture.office}
          preparedOn={capture.preparedOn}
          signatory={capture.signatory}
          stampEach={stampEach}
        />
      ) : null}
    </Card>
  );
}
