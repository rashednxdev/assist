'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Download, Loader2, Pencil, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import {
  NPS_2015,
  PAY_GRADES,
  isIsoDate,
  SALARY_BILL_LIMIT_CODE,
  calculateStaffArrears,
  formatTaka,
  isIncrementWithheld,
  asksJoiningDate,
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
import { SalaryBulkRequestDialog } from '@/components/salary/salary-bill-access';
import { TrForm15Staff, type TrStaffEntry } from '@/components/salary/tr-form-15';
import { STAMP_DUTY, type TrSignatory } from '@/components/salary/tr-form-parts';
import { SalaryJoiningDateField } from '@/components/salary/salary-joining-date';
import { ApiError, apiFetch } from '@/lib/api-client';
import { toEnglishDigits } from '@/lib/bangla-format';
import { downloadFormPdf, pdfFileName } from '@/lib/salary-pdf';
import { HRA_AREAS, hraAreaText, localNum, salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';

const NID_LENGTHS = [10, 13, 17];

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
  hraArea: HraArea;
  extras: ArrearExtras;
  joiningDate: string;
}

const EMPTY_FORM: StaffForm = {
  name: '',
  post: '',
  nid: '',
  grade: null,
  oldPay: 0,
  housingStatus: 'hra_eligible',
  hraArea: 'dhaka',
  extras: NO_ARREAR_EXTRAS,
  joiningDate: '',
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
  const [saving, setSaving] = useState(false);
  const askJoining = v.grade != null && asksJoiningDate(v.grade, v.oldPay);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = v.name.trim();
    const post = v.post.trim();
    const nid = v.nid.trim();
    if (name.length < 2) return setError(t.staffNameRequired);
    if (post.length < 2) return setError(t.staffPostRequired);
    if (nid && !NID_LENGTHS.includes(nid.length)) return setError(t.nidInvalid);
    if (!v.grade) return setError(t.gradeRequired);
    if (!NPS_2015[v.grade].includes(v.oldPay)) return setError(t.basicRequired);
    if (askJoining && !isIsoDate(v.joiningDate)) return setError(t.joiningDateRequired);
    setSaving(true);
    setError('');
    const message = await onSave({
      name,
      post,
      nid,
      grade: v.grade,
      old_pay: v.oldPay,
      housing_status: v.housingStatus,
      hra_area: v.hraArea,
      ...v.extras,
      joining_date: askJoining ? v.joiningDate : null,
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
              <Label htmlFor="staff-name">
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
              <Label htmlFor="staff-post">
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
          <div className="space-y-1.5">
            <Label htmlFor="staff-nid">{t.nid}</Label>
            <Input
              id="staff-nid"
              value={v.nid}
              inputMode="numeric"
              autoComplete="off"
              placeholder={t.nidPlaceholder}
              className="tabular-nums"
              onChange={(e) => setV((p) => ({ ...p, nid: toEnglishDigits(e.target.value).replace(/\D/g, '').slice(0, 17) }))}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
            <div className="space-y-1.5">
              <Label htmlFor="staff-grade">{t.grade}</Label>
              <select
                id="staff-grade"
                className={selectClass}
                value={v.grade ?? ''}
                onChange={(e) => {
                  const g = e.target.value === '' ? null : (Number(e.target.value) as PayGrade);
                  setV((p) => ({ ...p, grade: g, oldPay: g && NPS_2015[g].includes(p.oldPay) ? p.oldPay : 0 }));
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
              <Label htmlFor="staff-basic">{t.basicJune}</Label>
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
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-slate-800">{t.housing}</legend>
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
              <Label htmlFor="staff-hra-area">{t.hraArea}</Label>
              <select
                id="staff-hra-area"
                className={selectClass}
                value={v.hraArea}
                onChange={(e) => setV((p) => ({ ...p, hraArea: e.target.value as HraArea }))}
              >
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
  onCancel,
  onConfirm,
}: {
  locale: SalaryLocale;
  initial: string;
  locked: boolean;
  sign: StaffSignInput;
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
              {t.staffOfficeTitle}
            </h2>
            <p className="mt-1 text-sm text-muted">{t.staffOfficeHint}</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-md p-1 text-muted hover:bg-slate-100" aria-label={t.cancel}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-1.5 p-5">
          <Label htmlFor="staff-office">{t.officeName}</Label>
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
                <Label htmlFor="staff-sign-name">{t.signName}</Label>
                <Input
                  id="staff-sign-name"
                  value={s.name}
                  maxLength={120}
                  autoComplete="name"
                  onChange={(e) => setS((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="staff-sign-post">{t.signPost}</Label>
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
    if (message) setError(message);
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
          <Label htmlFor="staff-office-name">{t.officeName}</Label>
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

/** Office staff arrear bill: saved employee details, live arrears table and one T.R. Form 15 for all. */
export function SalaryStaffBill({
  locale,
  months,
  onMonthsChange,
  access,
  onAccessChange,
  officeLabel,
  officeLocked,
  preparedOn,
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
  /** Already in Bangla digits; printed on the form. */
  preparedOn: string;
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
  const [bulkDialog, setBulkDialog] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [sign, setSign] = useState<StaffSignInput>({ enabled: true, name: '', post: '' });
  const [capture, setCapture] = useState<{
    office: string;
    entries: TrStaffEntry[];
    signatory: TrSignatory | null;
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
  const staff = useMemo(
    () => allStaff?.filter((s) => (s.staff_office_id ?? null) === activeOffice) ?? null,
    [allStaff, activeOffice],
  );
  const staffIn = (officeId: string | null) => allStaff?.filter((s) => (s.staff_office_id ?? null) === officeId).length ?? 0;

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
  const stamp = STAMP_DUTY * valid.length;
  const remaining = access?.remaining ?? 0;
  const unlimited = Boolean(access?.unlimited);
  const enoughBills = unlimited || remaining >= count;

  async function save(details: StaffDetails): Promise<string | null> {
    const editing = dialog?.editing;
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
      return err instanceof Error ? err.message : t.calcError;
    }
    setDialog(null);
    return null;
  }

  async function remove(s: SalaryStaffRecord) {
    if (!window.confirm(t.staffDeleteConfirm(s.name))) return;
    setError('');
    try {
      await apiFetch(`/salary/staff/${s.id}`, { method: 'DELETE' });
      setAllStaff((prev) => (prev ?? []).filter((x) => x.id !== s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.calcError);
    }
  }

  async function saveOffice(name: string): Promise<string | null> {
    const editing = officeEdit?.editing;
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

  async function removeOffice(o: SalaryStaffOfficeRecord) {
    if (!window.confirm(t.staffOfficeDeleteConfirm(o.name, num(staffIn(o.id))))) return;
    setError('');
    try {
      await apiFetch(`/salary/staff/offices/${o.id}`, { method: 'DELETE' });
      setOffices((prev) => prev.filter((x) => x.id !== o.id));
      setAllStaff((prev) => (prev ?? []).filter((s) => s.staff_office_id !== o.id));
      setActiveOffice(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t.calcError);
    }
  }

  const billKey = (list: SalaryStaffRecord[]) =>
    JSON.stringify({ office: activeOffice, months: [...months].sort(), staff: list.map((s) => [s.id, s.updated_at]) });

  function startDownload() {
    setError('');
    const alreadyPaid = staff != null && paidFor.current === billKey(staff);
    if (!alreadyPaid && (!access?.can_bill || !enoughBills)) return setBulkDialog(true);
    setOfficeDialog(true);
  }

  async function confirmDownload(office: string, nextSign: StaffSignInput) {
    setOfficeDialog(false);
    setSign(nextSign);
    if (!staff || valid.length !== staff.length) return;
    const key = billKey(staff);
    setDownloading(true);
    setError('');
    if (paidFor.current !== key) {
      try {
        const res = await apiFetch<{ data: SalaryBillAccessRecord }>('/salary/staff/bill', {
          method: 'POST',
          body: JSON.stringify({ months, staff_office_id: activeOffice }),
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
              setBulkDialog(true);
            })
            .catch(() => {});
        }
        return;
      }
    }
    setCapture({
      office,
      signatory: nextSign.enabled ? { name: nextSign.name, post: nextSign.post, office } : null,
      entries: valid.map((r) => ({
        id: r.staff.id,
        name: r.staff.name,
        post: r.staff.post,
        nid: r.staff.nid,
        hraArea: r.staff.hra_area,
        result: r.result,
      })),
    });
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
              className="gap-1.5 border-amber-400 bg-white text-amber-900 hover:bg-amber-100"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.staffAddOffice}
            </Button>
          </div>
          {offices.length > 0 ? (
            <div className="flex flex-wrap gap-2" role="tablist">
              {[{ id: null as string | null, name: officeLabel || t.staffOwnOffice, own: true }, ...offices.map((o) => ({ id: o.id as string | null, name: o.name, own: false }))].map(
                (o) => {
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
                },
              )}
            </div>
          ) : null}
          {activeOfficeRec ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => setOfficeEdit({ editing: activeOfficeRec })}>
                <Pencil className="h-3.5 w-3.5" />
                {t.staffOfficeRename}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-1 border-rose-200 text-rose-700 hover:bg-rose-50"
                onClick={() => void removeOffice(activeOfficeRec)}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {t.staffOfficeDelete}
              </Button>
            </div>
          ) : null}
          <p className="text-xs text-amber-900">{t.staffOfficesHint}</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-800">
            {t.staffColEmployee}: {num(count)}
          </p>
          <Button type="button" onClick={() => setDialog({ editing: null })} className="gap-2 bg-amber-600 hover:bg-amber-700">
            <Plus className="h-4 w-4" />
            {t.staffAdd}
          </Button>
        </div>

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
                        <div className="text-xs text-muted">
                          {s.post}
                          {s.nid ? ` · ${t.nid}: ${num(s.nid)}` : ''}
                        </div>
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
                          onClick={() => void remove(s)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {t.staffDelete}
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
                        {t.staffStamp(num(valid.length))}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-rose-700">− {amt(stamp)}</td>
                      <td />
                    </tr>
                    <tr className="border-t-2 border-amber-300 bg-amber-100/70 font-bold">
                      <td className="px-3 py-2.5 text-amber-950" colSpan={7}>
                        {t.staffPayable}
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

        {count > 0 && months.length > 0 ? (
          <div className="space-y-2 text-center print:hidden">
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
            {!unlimited ? (
              <p className={`text-xs font-semibold ${enoughBills ? 'text-amber-900' : 'text-rose-700'}`}>
                {enoughBills ? t.staffBillsNeeded(num(count), num(remaining)) : t.staffNeedMore(num(count), num(remaining))}
              </p>
            ) : null}
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

      {officeDialog ? (
        <OfficeDialog
          locale={locale}
          initial={activeOfficeRec ? activeOfficeRec.name : officeLabel}
          locked={!activeOfficeRec && officeLocked}
          sign={sign}
          onCancel={() => setOfficeDialog(false)}
          onConfirm={(office, nextSign) =>
            void confirmDownload(!activeOfficeRec && officeLocked ? officeLabel : office, nextSign)
          }
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
          message={access.remaining > 0 && !access.request.pending ? t.staffNeedMore(num(count), num(remaining)) : undefined}
          onAccessChange={onAccessChange}
          onClose={() => setBulkDialog(false)}
        />
      ) : null}

      {capture ? (
        <TrForm15Staff
          ref={formRef}
          staff={capture.entries}
          months={months}
          office={capture.office}
          preparedOn={preparedOn}
          signatory={capture.signatory}
        />
      ) : null}
    </Card>
  );
}
