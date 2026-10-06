'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import type { OfficeOption, SalaryOfficeRecord, SalaryOfficeSettingsRecord } from '@ibas/shared-types';
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
const LATIN_LETTER = /[A-Za-z]/;

export function useSalaryOffice(): SalaryOfficeContextValue {
  return useContext(SalaryOfficeContext);
}

function OfficeForm({
  initial,
  othersAllowed,
  addBangla,
  onSaved,
  onCancel,
}: {
  initial: SalaryOfficeRecord | null;
  othersAllowed: boolean;
  /** An "Others" office saved without its Bangla name: only the names can be completed. */
  addBangla: boolean;
  onSaved: (office: SalaryOfficeRecord) => void;
  onCancel?: () => void;
}) {
  const [locale, setLocale] = useState<SalaryLocale>('bn');
  const t = salaryCopy(locale);
  const [circle, setCircle] = useState<OfficeOption | null>(initial?.circle ?? null);
  const [office, setOffice] = useState<OfficeOption | null>(initial?.office ?? null);
  const [others, setOthers] = useState(addBangla || (othersAllowed && Boolean(initial && !initial.office)));
  const [otherName, setOtherName] = useState(initial?.other_office_name ?? '');
  const [otherNameBn, setOtherNameBn] = useState(initial?.other_office_name_bn ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const showOthersOption = othersAllowed && !addBangla;

  async function save() {
    const name = otherName.trim();
    const nameBn = otherNameBn.trim();
    if (others && (name.length < 3 || !LATIN_LETTER.test(name))) return setError(t.officeErrOther);
    if (others && (nameBn.length < 3 || !BANGLA_SCRIPT.test(nameBn))) return setError(t.officeErrOtherBn);
    if (!others && !circle) return setError(t.officeErrCircle);
    if (!others && !office) return setError(t.officeErrOffice);
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch<{ data: SalaryOfficeRecord }>('/salary/office', {
        method: 'PUT',
        body: JSON.stringify({
          circle_id: circle?.id ?? null,
          office_id: others ? null : (office?.id ?? null),
          other_office_name: others ? name : '',
          other_office_name_bn: others ? nameBn : '',
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
                {addBangla ? t.officeAddBangla : showOthersOption ? t.officeGateIntro : t.officeGateIntroListed}
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
          <div className="space-y-1.5">
            <Label htmlFor="salary-office-circle">
              {t.officeCircle} {others ? <span className="font-normal text-muted">{t.officeOptional}</span> : null}
            </Label>
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

          {others ? null : (
            <div className="space-y-1.5">
              <Label htmlFor="salary-office-office">{t.officeOffice}</Label>
              <OfficePicker
                id="salary-office-office"
                departmentId={circle?.id}
                disabled={!circle}
                value={office}
                placeholder={circle ? t.officeOfficePlaceholder : t.officeCircleFirst}
                onChange={setOffice}
              />
            </div>
          )}

          {showOthersOption ? (
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2.5 text-sm font-medium">
              <input
                type="checkbox"
                className="h-4 w-4 rounded"
                checked={others}
                onChange={(e) => {
                  setOthers(e.target.checked);
                  setError('');
                }}
              />
              {t.officeOthers}
            </label>
          ) : null}

          {others ? (
            <div className="space-y-3">
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
                  onChange={(e) => setOtherNameBn(e.target.value)}
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
                  onChange={(e) => setOtherName(e.target.value)}
                />
              </div>
            </div>
          ) : null}

          {onCancel ? null : <p className="text-xs font-medium text-rose-700">{t.officeLockNote}</p>}

          {error ? <Alert variant="error">{error}</Alert> : null}

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

  if (editing || addBangla || (!office && !exempt)) {
    return (
      <OfficeForm
        initial={office}
        othersAllowed={othersAllowed}
        addBangla={addBangla}
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
