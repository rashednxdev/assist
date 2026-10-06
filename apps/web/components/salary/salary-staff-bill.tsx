'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, Pencil, Plus, ShieldCheck, Trash2, Users, X } from 'lucide-react';
import {
  NPS_2015,
  PAY_GRADES,
  SALARY_BILL_LIMIT_CODE,
  calculateStaffArrears,
  formatTaka,
  type HousingStatus,
  type HraArea,
  type PayGrade,
  type SalaryArrearResult,
  type SalaryBillAccessRecord,
  type SalaryStaffDto,
  type SalaryStaffRecord,
} from '@ibas/shared-types';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrearMonthPicker } from '@/components/salary/salary-arrears-bill';
import { SalaryBulkRequestDialog } from '@/components/salary/salary-bill-access';
import { TrForm15Staff, type TrStaffEntry } from '@/components/salary/tr-form-15';
import { STAMP_DUTY } from '@/components/salary/tr-form-parts';
import { ApiError, apiFetch } from '@/lib/api-client';
import { toEnglishDigits } from '@/lib/bangla-format';
import { downloadFormPdf, pdfFileName } from '@/lib/salary-pdf';
import { HRA_AREAS, hraAreaText, localNum, salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';

const NID_LENGTHS = [10, 13, 17];

const selectClass =
  'flex h-10 w-full rounded-md border border-amber-300 bg-white px-3 text-sm font-medium focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200 disabled:cursor-not-allowed disabled:bg-slate-100';

interface StaffForm {
  name: string;
  post: string;
  nid: string;
  grade: PayGrade | null;
  oldPay: number;
  housingStatus: HousingStatus;
  hraArea: HraArea;
}

const EMPTY_FORM: StaffForm = {
  name: '',
  post: '',
  nid: '',
  grade: null,
  oldPay: 0,
  housingStatus: 'hra_eligible',
  hraArea: 'dhaka',
};

function toForm(s: SalaryStaffRecord): StaffForm {
  return {
    name: s.name,
    post: s.post,
    nid: s.nid,
    grade: s.grade as PayGrade,
    oldPay: s.old_pay,
    housingStatus: s.housing_status,
    hraArea: s.hra_area,
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
  onSave: (dto: SalaryStaffDto) => Promise<string | null>;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const [v, setV] = useState<StaffForm>(initial);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

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
                        {`${num(formatTaka(amount))} — ${t.stepOption(num(i + 1))}`}
                      </option>
                    ))
                  : null}
              </select>
            </div>
          </div>
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

function OfficeDialog({
  locale,
  initial,
  onCancel,
  onConfirm,
}: {
  locale: SalaryLocale;
  initial: string;
  onCancel: () => void;
  onConfirm: (office: string) => void;
}) {
  const t = salaryCopy(locale);
  const [office, setOffice] = useState(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden" role="dialog" aria-modal="true">
      <button type="button" aria-label={t.cancel} className="absolute inset-0 bg-slate-900/50" onClick={onCancel} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(office.trim());
        }}
        className="relative w-full max-w-md rounded-2xl bg-surface shadow-xl"
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
          <Input id="staff-office" value={office} onChange={(e) => setOffice(e.target.value)} autoFocus />
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

/** Office staff arrear bill: saved employee details, live arrears table and one T.R. Form 15 for all. */
export function SalaryStaffBill({
  locale,
  months,
  onMonthsChange,
  access,
  onAccessChange,
  officeLabel,
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
  /** Already in Bangla digits; printed on the form. */
  preparedOn: string;
  accessPanel: React.ReactNode;
  contactsPanel: React.ReactNode;
}) {
  const t = salaryCopy(locale);
  const num = (v: string | number) => localNum(locale, v);
  const amt = (n: number) => num(formatTaka(n));
  const signed = (n: number) => (n < 0 ? `− ${amt(-n)}` : amt(n));

  const [staff, setStaff] = useState<SalaryStaffRecord[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [dialog, setDialog] = useState<{ editing: SalaryStaffRecord | null } | null>(null);
  const [officeDialog, setOfficeDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [capture, setCapture] = useState<{ office: string; entries: TrStaffEntry[] } | null>(null);
  const paidFor = useRef<string | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoadError(false);
    try {
      const res = await apiFetch<{ data: SalaryStaffRecord[] }>('/salary/staff');
      setStaff(res.data);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    void load();
  }, []);

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

  async function save(dto: SalaryStaffDto): Promise<string | null> {
    const editing = dialog?.editing;
    try {
      if (editing) {
        const res = await apiFetch<{ data: SalaryStaffRecord }>(`/salary/staff/${editing.id}`, {
          method: 'PUT',
          body: JSON.stringify(dto),
        });
        setStaff((prev) => (prev ?? []).map((s) => (s.id === editing.id ? res.data : s)));
      } else {
        const res = await apiFetch<{ data: SalaryStaffRecord }>('/salary/staff', {
          method: 'POST',
          body: JSON.stringify(dto),
        });
        setStaff((prev) => [...(prev ?? []), res.data]);
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
      setStaff((prev) => (prev ?? []).filter((x) => x.id !== s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : t.calcError);
    }
  }

  const billKey = (list: SalaryStaffRecord[]) =>
    JSON.stringify({ months: [...months].sort(), staff: list.map((s) => [s.id, s.updated_at]) });

  function startDownload() {
    setError('');
    const alreadyPaid = staff != null && paidFor.current === billKey(staff);
    if (!alreadyPaid && (!access?.can_bill || !enoughBills)) return setBulkDialog(true);
    setOfficeDialog(true);
  }

  async function confirmDownload(office: string) {
    setOfficeDialog(false);
    if (!staff || valid.length !== staff.length) return;
    const key = billKey(staff);
    setDownloading(true);
    setError('');
    if (paidFor.current !== key) {
      try {
        const res = await apiFetch<{ data: SalaryBillAccessRecord }>('/salary/staff/bill', {
          method: 'POST',
          body: JSON.stringify({ months }),
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
        await downloadFormPdf(root, pdfFileName('TR Form 15', 'Office Staff Arrears', `${capture.entries.length} staff`));
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
          initial={officeLabel}
          onCancel={() => setOfficeDialog(false)}
          onConfirm={(office) => void confirmDownload(office)}
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
        <TrForm15Staff ref={formRef} staff={capture.entries} months={months} office={capture.office} preparedOn={preparedOn} />
      ) : null}
    </Card>
  );
}
