'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import {
  salaryNeedsAccountingOffice,
  type OfficeOption,
  type SalaryOfficeRecord,
  type SalaryOfficeSettingsRecord,
  type SalaryOtherOfficeKind,
  type SalaryOtherOfficeSuggestion,
} from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { isPlatformAdmin } from '@/lib/capabilities';
import { salaryCopy, type SalaryLocale } from '@/lib/salary-i18n';
import { useSalaryUser } from '@/components/salary/salary-auth-gate';
import { OfficePicker } from '@/components/org/office-picker';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SalaryOfficeContextValue {
  office: SalaryOfficeRecord | null;
  /** Only admins change their own office here; for everyone else the admin changes it. */
  canChange: boolean;
  changeOffice: () => void;
}

const SalaryOfficeContext = createContext<SalaryOfficeContextValue>({
  office: null,
  canChange: false,
  changeOffice: () => undefined,
});

const BANGLA_SCRIPT = /[\u0980-\u09FF]/;
const LATIN_LETTER = /[A-Za-z]/

type OfficePath = 'accounts' | 'others';

export function useSalaryOffice(): SalaryOfficeContextValue {
  return useContext(SalaryOfficeContext);
}

function OfficeForm({
  initial,
  othersAllowed,
  addBangla,
  accountingOnly = false,
  onSaved,
  onCancel,
}: {
  initial: SalaryOfficeRecord | null;
  othersAllowed: boolean;
  /** An "Others" office saved without its Bangla name: only the names can be completed. */
  addBangla: boolean;
  /** A saved office without its bill-passing office: only that can be chosen. */
  accountingOnly?: boolean;
  onSaved: (office: SalaryOfficeRecord) => void;
  onCancel?: () => void;
}) {
  const [locale, setLocale] = useState<SalaryLocale>('bn');
  const t = salaryCopy(locale);
  const [circle, setCircle] = useState<OfficeOption | null>(initial?.circle ?? null);
  const [office, setOffice] = useState<OfficeOption | null>(initial?.office ?? null);
  const initialOthers = addBangla || (othersAllowed && Boolean(initial && !initial.office));
  const [path, setPath] = useState<OfficePath | null>(() => {
    if (accountingOnly) return null;
    if (addBangla || (initial && !initial.office && initial.other_office_name)) return 'others';
    if (initial?.office) return 'accounts';
    if (!othersAllowed) return 'accounts';
    return null;
  });
  const others = path === 'others' || initialOthers;
  const [otherName, setOtherName] = useState(initial?.other_office_name ?? '');
  const [otherNameBn, setOtherNameBn] = useState(initial?.other_office_name_bn ?? '');
  const [otherKind, setOtherKind] = useState<SalaryOtherOfficeKind | null>(
    initial?.other_office_kind ?? (addBangla ? 'gob' : null),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SalaryOtherOfficeSuggestion[]>([]);
  const [accounting, setAccounting] = useState<OfficeOption | null>(initial?.accounting_office ?? null);
  const showPathChoice = othersAllowed && !addBangla && !accountingOnly && path == null;
  const showAccountsFields = !accountingOnly && !addBangla && (path === 'accounts' || (!othersAllowed && path !== 'others'));
  const showOthersFields = others && !accountingOnly;
  /** For Others: GOB/Statutory first; only then circle, names, and bill-pass. */
  const othersKindChosen = otherKind != null;
  const needsAccounting =
    accountingOnly ||
    (others
      ? salaryNeedsAccountingOffice({ is_other: true, office_type: null, other_office_kind: otherKind })
      : office != null && salaryNeedsAccountingOffice({ is_other: false, office_type: office.type_short ?? null }));
  const picked = suggestions.some(
    (s) => s.other_office_name === otherName.trim() && s.other_office_name_bn === otherNameBn.trim(),
  );

  useEffect(() => {
    const q = query.trim();
    if (!others || q.length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiFetch<{ data: SalaryOtherOfficeSuggestion[] }>(`/salary/office/others?q=${encodeURIComponent(q)}`)
        .then((res) => {
          if (!cancelled) setSuggestions(res.data);
        })
        .catch(() => undefined);
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, others]);

  function pick(s: SalaryOtherOfficeSuggestion) {
    setOtherName(s.other_office_name);
    setOtherNameBn(s.other_office_name_bn);
    setError('');
  }

  function choosePath(next: OfficePath) {
    setPath(next);
    setError('');
    if (next === 'accounts') {
      setOtherKind(null);
      setOtherName('');
      setOtherNameBn('');
      setAccounting(null);
    } else {
      setOffice(null);
      setOtherKind(null);
      setAccounting(null);
    }
  }

  async function save() {
    const name = otherName.trim();
    const nameBn = otherNameBn.trim();
    if (!accountingOnly) {
      if (showPathChoice || (othersAllowed && !addBangla && path == null)) return setError(t.officeErrPath);
      if (others && !otherKind) return setError(t.officeErrOtherKind);
      if (others && (name.length < 3 || !LATIN_LETTER.test(name))) return setError(t.officeErrOther);
      if (others && (nameBn.length < 3 || !BANGLA_SCRIPT.test(nameBn))) return setError(t.officeErrOtherBn);
      if (!others && !circle) return setError(t.officeErrCircle);
      if (!others && !office) return setError(t.officeErrOffice);
    }
    if (needsAccounting && !accounting) return setError(t.officeErrAccounting);
    setSaving(true);
    setError('');
    try {
      const res = accountingOnly
        ? await apiFetch<{ data: SalaryOfficeRecord }>('/salary/office/accounting', {
            method: 'PUT',
            body: JSON.stringify({ accounting_office_id: accounting?.id }),
          })
        : await apiFetch<{ data: SalaryOfficeRecord }>('/salary/office', {
            method: 'PUT',
            body: JSON.stringify({
              circle_id: circle?.id ?? null,
              office_id: others ? null : (office?.id ?? null),
              other_office_name: others ? name : '',
              other_office_name_bn: others ? nameBn : '',
              other_office_kind: others ? otherKind : null,
              accounting_office_id: needsAccounting ? (accounting?.id ?? null) : null,
            }),
          });
      onSaved(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f7f5] p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-md">
        <div className="flex items-start justify-between gap-3 bg-[#0b3d2e] px-5 py-4 text-white">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10">
              <Building2 className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-lg font-bold">{t.officeGateTitle}</h1>
              <p className="mt-0.5 text-xs text-emerald-100/90">
                {accountingOnly
                  ? t.officeAccountingNeeded
                  : addBangla
                    ? t.officeAddBangla
                    : showPathChoice
                      ? t.officeGateIntro
                      : path === 'others'
                        ? t.officePathHintOthers
                        : t.officeGateIntroListed}
              </p>
            </div>
          </div>
          <div className="inline-flex shrink-0 rounded-lg border border-white/30 bg-white/5 p-0.5 text-xs" role="group" aria-label="Language">
            {(['bn', 'en'] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => setLocale(l)}
                className={cn('rounded-md px-2 py-1 font-semibold', locale === l ? 'bg-white text-[#0b3d2e]' : 'text-white/80')}
              >
                {l === 'bn' ? 'বাংলা' : 'EN'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-4 p-5">
          {accountingOnly ? (
            <div className="rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-sm">
              <div className="text-xs text-muted">{t.officeOffice}</div>
              <div className="font-semibold text-slate-900">{initial?.other_office_name_bn || initial?.label}</div>
            </div>
          ) : null}

          {showPathChoice ? (
            <div className="space-y-2 rounded-lg border border-emerald-300 bg-emerald-50/70 p-3">
              <p className="text-sm font-bold text-emerald-950">{t.officePathLabel}</p>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto border-emerald-300 bg-white py-3 text-emerald-950 hover:bg-emerald-100"
                  onClick={() => choosePath('accounts')}
                >
                  {t.officePathAccounts}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-auto border-emerald-300 bg-white py-3 text-emerald-950 hover:bg-emerald-100"
                  onClick={() => choosePath('others')}
                >
                  {t.officePathOthers}
                </Button>
              </div>
              <p className="text-xs text-emerald-900">{t.officePathHintAccounts}</p>
              <p className="text-xs text-emerald-900">{t.officePathHintOthers}</p>
            </div>
          ) : null}

          {path != null && showPathChoice === false && othersAllowed && !addBangla && !accountingOnly ? (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-900">
                {path === 'accounts' ? t.officePathAccounts : t.officePathOthers}
              </span>
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => {
                  setPath(null);
                  setOtherKind(null);
                  setOffice(null);
                  setAccounting(null);
                  setError('');
                }}
              >
                {t.officeCancel}
              </button>
            </div>
          ) : null}

          {/* Accounts office: circle + office list */}
          {showAccountsFields ? (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="salary-office-circle">{t.officeCircle}</Label>
                <OfficePicker
                  id="salary-office-circle"
                  topLevel
                  allowClear
                  value={circle}
                  placeholder={t.officeCirclePlaceholder}
                  onChange={(c) => {
                    setCircle(c);
                    if (c?.id !== circle?.id) setOffice(null);
                  }}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="salary-office-office">{t.officeOffice}</Label>
                <OfficePicker
                  id="salary-office-office"
                  shortLabel
                  departmentId={circle?.id}
                  disabled={!circle}
                  value={office}
                  placeholder={circle ? t.officeOfficePlaceholder : t.officeCircleFirst}
                  onChange={setOffice}
                />
              </div>
            </>
          ) : null}

          {/* Others: GOB / Statutory first */}
          {showOthersFields ? (
            <div className="space-y-3">
              <div className="space-y-2 rounded-lg border border-indigo-300 bg-indigo-50/70 p-3">
                <p className="text-sm font-bold text-indigo-950">{t.officeOtherKindLabel}</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={otherKind === 'gob' ? 'default' : 'outline'}
                    className={
                      otherKind === 'gob'
                        ? 'bg-indigo-700 hover:bg-indigo-800'
                        : 'border-indigo-300 bg-white text-indigo-950 hover:bg-indigo-100'
                    }
                    onClick={() => {
                      setOtherKind('gob');
                      setError('');
                    }}
                  >
                    {t.officeOtherKindGob}
                  </Button>
                  <Button
                    type="button"
                    variant={otherKind === 'autonomous' ? 'default' : 'outline'}
                    className={
                      otherKind === 'autonomous'
                        ? 'bg-indigo-700 hover:bg-indigo-800'
                        : 'border-indigo-300 bg-white text-indigo-950 hover:bg-indigo-100'
                    }
                    onClick={() => {
                      setOtherKind('autonomous');
                      setAccounting(null);
                      setError('');
                    }}
                  >
                    {t.officeOtherKindAutonomous}
                  </Button>
                </div>
                {otherKind === 'gob' ? (
                  <p className="text-xs font-medium text-indigo-900">{t.officeOtherKindHintGob}</p>
                ) : null}
                {otherKind === 'autonomous' ? (
                  <p className="text-xs font-medium text-indigo-900">{t.officeOtherKindHintAutonomous}</p>
                ) : null}
              </div>

              {othersKindChosen || addBangla ? (
                <>
                  {!addBangla ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="salary-office-circle-others">
                        {t.officeCircle} <span className="font-normal text-muted">{t.officeOptional}</span>
                      </Label>
                      <OfficePicker
                        id="salary-office-circle-others"
                        topLevel
                        allowClear
                        value={circle}
                        placeholder={t.officeCirclePlaceholder}
                        onChange={(c) => {
                          setCircle(c);
                          setError('');
                        }}
                      />
                    </div>
                  ) : null}

                  <p className="rounded-md border border-yellow-400 bg-gradient-to-r from-yellow-200 via-yellow-50 to-white px-3 py-2 text-xs font-semibold text-amber-950">
                    {t.officeOthersNotice}
                  </p>
                  <div className="space-y-1.5">
                    <Label htmlFor="salary-office-other-bn">{t.officeOtherNameBn}</Label>
                    <Input
                      id="salary-office-other-bn"
                      lang="bn"
                      maxLength={200}
                      value={otherNameBn}
                      placeholder={t.officeOtherPlaceholderBn}
                      onChange={(e) => {
                        setOtherNameBn(e.target.value);
                        setQuery(e.target.value);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="salary-office-other">{t.officeOtherName}</Label>
                    <Input
                      id="salary-office-other"
                      lang="en"
                      maxLength={200}
                      value={otherName}
                      placeholder={t.officeOtherPlaceholder}
                      onChange={(e) => {
                        setOtherName(e.target.value);
                        setQuery(e.target.value);
                      }}
                    />
                  </div>
                  {suggestions.length > 0 ? (
                    <div className="space-y-2 rounded-lg border border-sky-300 bg-sky-50 p-3">
                      <p className="text-xs font-semibold text-sky-950">{t.officeExistingTitle}</p>
                      <ul className="space-y-1.5">
                        {suggestions.map((s) => {
                          const selected =
                            s.other_office_name === otherName.trim() && s.other_office_name_bn === otherNameBn.trim();
                          return (
                            <li
                              key={`${s.other_office_name_bn}|${s.other_office_name}`}
                              className={cn(
                                'flex items-center justify-between gap-2 rounded-md border bg-white px-2.5 py-2',
                                selected ? 'border-emerald-500 ring-2 ring-emerald-200' : 'border-sky-200',
                              )}
                            >
                              <div className="min-w-0 text-sm">
                                <div className="font-semibold text-slate-900">{s.other_office_name_bn}</div>
                                <div className="text-xs text-slate-600">{s.other_office_name}</div>
                                <div className="text-[11px] text-sky-800">{t.officeExistingUsers(String(s.users))}</div>
                              </div>
                              <Button
                                type="button"
                                size="sm"
                                variant={selected ? 'default' : 'outline'}
                                className={selected ? 'bg-emerald-700 hover:bg-emerald-800' : undefined}
                                onClick={() => pick(s)}
                              >
                                {selected ? t.officeExistingSelected : t.officeExistingSelect}
                              </Button>
                            </li>
                          );
                        })}
                      </ul>
                      {picked ? <p className="text-xs font-semibold text-emerald-800">{t.officeExistingPicked}</p> : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ) : null}

          {/* Bill-passing (pass) office — after GOB/Statutory for others, or when listed office needs it */}
          {needsAccounting && (accountingOnly || !others || othersKindChosen || addBangla) ? (
            <div className="space-y-1.5 rounded-lg border border-emerald-300 bg-emerald-50/60 p-3">
              <Label htmlFor="salary-office-accounting">{t.officeAccounting}</Label>
              <OfficePicker
                id="salary-office-accounting"
                searchPath="/salary/office/bill-passing"
                value={accounting}
                placeholder={t.officeAccountingPlaceholder}
                onChange={(o) => {
                  setAccounting(o);
                  setError('');
                }}
              />
              <p className="text-xs text-emerald-900">{t.officeAccountingHint}</p>
            </div>
          ) : null}

          {onCancel ? null : <p className="text-xs font-medium text-rose-700">{t.officeLockNote}</p>}

          {error ? <Alert variant="error">{error}</Alert> : null}

          {!showPathChoice ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => void save()} disabled={saving} className="bg-emerald-700 hover:bg-emerald-800">
                {saving ? t.officeSaving : t.officeSave}
              </Button>
              {onCancel ? (
                <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
                  {t.officeCancel}
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Ordinary users must name their office (a listed office in a circle, or Others) before using /salary. */
export function SalaryOfficeGate({ children }: { children: React.ReactNode }) {
  const me = useSalaryUser();
  const exempt = isPlatformAdmin(me);
  const [office, setOffice] = useState<SalaryOfficeRecord | null>(null);
  const [othersAllowed, setOthersAllowed] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(() => {
    setLoadError(false);
    Promise.all([
      apiFetch<{ data: SalaryOfficeRecord | null }>('/salary/office'),
      apiFetch<{ data: SalaryOfficeSettingsRecord }>('/salary/office/settings'),
    ])
      .then(([officeRes, settingsRes]) => {
        setOffice(officeRes.data);
        setOthersAllowed(settingsRes.data.others_allowed);
        setLoaded(true);
      })
      .catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const changeOffice = useCallback(() => {
    if (exempt) setEditing(true);
  }, [exempt]);

  if (loadError) {
    const t = salaryCopy('bn');
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f5] p-6">
        <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-white p-6 text-sm shadow-md">
          <p>{t.officeLoadError}</p>
          <Button type="button" variant="outline" onClick={load}>
            {t.retry}
          </Button>
        </div>
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f5] p-6">
        <div className="w-full max-w-sm space-y-3 rounded-xl border border-border bg-white p-6 shadow-md">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  const addBangla = !exempt && office != null && !office.office && !office.other_office_name_bn;
  const addAccounting = !exempt && !addBangla && office != null && office.needs_accounting_office;

  if (editing || addBangla || addAccounting || (!office && !exempt)) {
    return (
      <OfficeForm
        initial={office}
        othersAllowed={othersAllowed}
        addBangla={addBangla}
        accountingOnly={addAccounting}
        onSaved={(saved) => {
          setOffice(saved);
          setEditing(false);
        }}
        onCancel={editing && (office || exempt) ? () => setEditing(false) : undefined}
      />
    );
  }

  return (
    <SalaryOfficeContext.Provider value={{ office, canChange: exempt, changeOffice }}>{children}</SalaryOfficeContext.Provider>
  );
}
