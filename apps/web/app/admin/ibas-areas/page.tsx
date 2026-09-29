'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, ExternalLink, Link2, ListChecks, Pencil, Plus, Search, X } from 'lucide-react';
import { POLICY_COLLECTIONS, type PolicyCollectionCode } from '@ibas/shared-constants';
import type { IbasAreaRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { invalidateIbasAreas } from '@/lib/use-ibas-areas';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

const textareaClass = 'flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm';
const SWATCHES = ['#1E40AF', '#0F766E', '#7C3AED', '#B45309', '#BE123C', '#15803D', '#0369A1', '#6D28D9', '#C2410C', '#334155'];

interface ModuleOption {
  code: string;
  name_en: string;
  is_active?: boolean;
}

interface FormState {
  code_suffix: string;
  name_en: string;
  name_bn: string;
  description_en: string;
  color: string;
  legacy_codes: string[];
  policy_collections: PolicyCollectionCode[];
  sort_order: string;
  is_active: boolean;
}

function blankForm(nextSort: number): FormState {
  return {
    code_suffix: '',
    name_en: '',
    name_bn: '',
    description_en: '',
    color: SWATCHES[0]!,
    legacy_codes: [],
    policy_collections: [],
    sort_order: String(nextSort),
    is_active: true,
  };
}

function toForm(a: IbasAreaRecord): FormState {
  return {
    code_suffix: a.code.replace(/^IBAS_/, ''),
    name_en: a.name_en,
    name_bn: a.name_bn,
    description_en: a.description_en,
    color: a.color,
    legacy_codes: a.legacy_codes,
    policy_collections: a.policy_collections,
    sort_order: String(a.sort_order),
    is_active: a.is_active,
  };
}

function toPayload(f: FormState) {
  return {
    name_en: f.name_en.trim(),
    name_bn: f.name_bn.trim(),
    description_en: f.description_en.trim(),
    color: f.color,
    legacy_codes: f.legacy_codes,
    policy_collections: f.policy_collections,
    sort_order: Number.parseInt(f.sort_order, 10) || 0,
    is_active: f.is_active,
  };
}

/** "Bank Reconciliation" → "BANK_RECONCILIATION" (without the IBAS_ prefix). */
const suffixFromName = (name: string) =>
  name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 30);

const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

function AreaForm({
  editing,
  initial,
  modules,
  areaCodes,
  onSaved,
  onCancel,
}: {
  editing: IbasAreaRecord | null;
  initial: FormState;
  modules: ModuleOption[];
  areaCodes: string[];
  onSaved: (list: IbasAreaRecord[], message: string) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState(initial);
  const [codeTouched, setCodeTouched] = useState(false);
  const [moduleQ, setModuleQ] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setF(initial);
    setCodeTouched(false);
    setError('');
  }, [initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setF((prev) => ({ ...prev, [key]: value }));
  const code = `IBAS_${f.code_suffix}`;

  const officeModules = useMemo(() => {
    const term = moduleQ.trim().toLowerCase();
    return modules
      .filter((m) => !areaCodes.includes(m.code))
      .filter((m) => !term || m.code.toLowerCase().includes(term) || m.name_en.toLowerCase().includes(term))
      .sort((a, b) => Number(f.legacy_codes.includes(b.code)) - Number(f.legacy_codes.includes(a.code)) || a.name_en.localeCompare(b.name_en));
  }, [modules, areaCodes, moduleQ, f.legacy_codes]);

  async function save() {
    setError('');
    if (!f.name_en.trim()) {
      setError('English name is required.');
      return;
    }
    if (!editing && !/^[A-Z0-9_]{2,30}$/.test(f.code_suffix)) {
      setError('Code needs 2–30 capital letters, digits or underscores after IBAS_.');
      return;
    }
    setSaving(true);
    try {
      const r = await apiFetch<{ data: IbasAreaRecord[] }>(editing ? `/ibas/admin/areas/${editing.code}` : '/ibas/admin/areas', {
        method: editing ? 'PUT' : 'POST',
        body: JSON.stringify(editing ? toPayload(f) : { ...toPayload(f), code }),
      });
      invalidateIbasAreas();
      onSaved(r.data, editing ? `Saved “${f.name_en.trim()}”.` : `Added “${f.name_en.trim()}”. Grant its module (${code}) to users to open it.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{editing ? `Edit ${editing.name_en}` : 'New iBAS++ area'}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <X className="h-4 w-4" /> Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <Alert variant="error">{error}</Alert>}
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="ar-name">Name (English) *</Label>
            <Input
              id="ar-name"
              value={f.name_en}
              maxLength={120}
              placeholder="e.g. Bank Reconciliation"
              onChange={(e) => {
                const name = e.target.value;
                setF((prev) => ({ ...prev, name_en: name, code_suffix: editing || codeTouched ? prev.code_suffix : suffixFromName(name) }));
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ar-name-bn">Name (Bangla)</Label>
            <Input id="ar-name-bn" value={f.name_bn} maxLength={120} onChange={(e) => set('name_bn', e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ar-code">Code (module code) {editing ? '' : '*'}</Label>
            <div className="flex">
              <span className="inline-flex items-center rounded-l-md border border-r-0 border-input bg-slate-50 px-3 font-mono text-sm text-muted">
                IBAS_
              </span>
              <Input
                id="ar-code"
                className="rounded-l-none font-mono"
                value={f.code_suffix}
                disabled={!!editing}
                maxLength={30}
                onChange={(e) => {
                  setCodeTouched(true);
                  set('code_suffix', e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''));
                }}
              />
            </div>
            <p className="text-xs text-muted">
              {editing ? 'The code cannot change — user grants and tags use it.' : 'Used to grant access. It cannot be changed later.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ar-sort">Display order</Label>
            <Input id="ar-sort" type="number" min={0} max={10000} value={f.sort_order} onChange={(e) => set('sort_order', e.target.value)} />
            <p className="text-xs text-muted">Lower numbers are listed first.</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="ar-desc">Description</Label>
          <textarea
            id="ar-desc"
            rows={2}
            maxLength={500}
            className={textareaClass}
            value={f.description_en}
            onChange={(e) => set('description_en', e.target.value)}
            placeholder="What work belongs in this area — shown on the workspace card"
          />
        </div>

        <div className="space-y-1.5">
          <Label>Colour</Label>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                onClick={() => set('color', c)}
                className={`h-7 w-7 rounded-full border-2 ${f.color.toLowerCase() === c.toLowerCase() ? 'border-foreground' : 'border-transparent'}`}
                style={{ backgroundColor: c }}
              />
            ))}
            <input
              type="color"
              value={f.color}
              onChange={(e) => set('color', e.target.value.toUpperCase())}
              className="h-8 w-10 cursor-pointer rounded border border-input bg-background"
              aria-label="Custom colour"
            />
            <span className="font-mono text-xs text-muted">{f.color}</span>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <fieldset className="space-y-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium">Policy collections (books shown in the drawer)</legend>
            {POLICY_COLLECTIONS.map((c) => (
              <label key={c.code} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={f.policy_collections.includes(c.code)}
                  onChange={() => set('policy_collections', toggle(f.policy_collections, c.code))}
                />
                {c.name_en}
              </label>
            ))}
          </fieldset>
          <fieldset className="space-y-2 rounded-lg border border-border p-3">
            <legend className="px-1 text-sm font-medium">Also opens for users of these modules (optional)</legend>
            <p className="text-xs text-muted">
              Users with any ticked module can open this area, and that module&apos;s published workflow tasks are listed
              under Procedures.
            </p>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <Input value={moduleQ} onChange={(e) => setModuleQ(e.target.value)} placeholder="Filter modules…" className="h-8 pl-8 text-xs" />
            </div>
            <div className="max-h-48 space-y-1.5 overflow-y-auto pr-1">
              {officeModules.map((m) => (
                <label key={m.code} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={f.legacy_codes.includes(m.code)} onChange={() => set('legacy_codes', toggle(f.legacy_codes, m.code))} />
                  <span className="min-w-0 flex-1 truncate">{m.name_en}</span>
                  <code className="text-[11px] text-muted">{m.code}</code>
                </label>
              ))}
              {officeModules.length === 0 && <p className="text-xs text-muted">No modules match.</p>}
            </div>
          </fieldset>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={f.is_active} onChange={(e) => set('is_active', e.target.checked)} />
          Show this area in the iBAS++ Workspace
        </label>

        <div className="flex flex-wrap gap-2">
          <Button disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : editing ? 'Save area' : 'Create area'}
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function IbasAreasAdminPage() {
  const [areas, setAreas] = useState<IbasAreaRecord[] | null>(null);
  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<IbasAreaRecord | null>(null);
  const [creating, setCreating] = useState(false);
  const [busyCode, setBusyCode] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ data: IbasAreaRecord[] }>('/ibas/admin/areas')
      .then((r) => setAreas(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load areas'));
    apiFetch<{ data: ModuleOption[] }>('/setup/modules?all=true')
      .then((r) => setModules(r.data))
      .catch(() => setModules([]));
  }, []);

  const areaCodes = useMemo(() => (areas ?? []).map((a) => a.code), [areas]);
  const nextSort = useMemo(() => Math.max(0, ...(areas ?? []).map((a) => a.sort_order)) + 10, [areas]);
  const formInitial = useMemo(() => (editing ? toForm(editing) : blankForm(nextSort)), [editing, nextSort]);

  function openCreate() {
    setMessage('');
    setEditing(null);
    setCreating(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function openEdit(a: IbasAreaRecord) {
    setMessage('');
    setCreating(false);
    setEditing(a);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeForm() {
    setEditing(null);
    setCreating(false);
  }

  async function toggleVisible(a: IbasAreaRecord) {
    setBusyCode(a.code);
    setError('');
    try {
      const r = await apiFetch<{ data: IbasAreaRecord[] }>(`/ibas/admin/areas/${a.code}`, {
        method: 'PUT',
        body: JSON.stringify({ ...toPayload(toForm(a)), is_active: !a.is_active }),
      });
      invalidateIbasAreas();
      setAreas(r.data);
      setMessage(a.is_active ? `“${a.name_en}” is hidden from the workspace.` : `“${a.name_en}” is shown in the workspace again.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setBusyCode(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="iBAS++ Workspace areas"
        description="Add and edit the service areas users see in the iBAS++ Workspace. Every area is also a module, so it can be granted, charged for or stopped like any other module."
        action={
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4" /> New area
          </Button>
        }
      />

      <Alert variant="info">
        After creating an area: grant its module code to users (Users → access), tag workflow tasks with it in{' '}
        <Link href="/workflow/admin" className="font-medium underline">Workflow admin</Link>, link rules and circulars in{' '}
        <Link href="/admin/ibas-links" className="font-medium underline">area links</Link>, and tick it on checklists in the{' '}
        <Link href="/admin/toolkit" className="font-medium underline">Toolkit</Link>. To pause an area for everyone, stop its module in{' '}
        <Link href="/admin/setup/modules" className="font-medium underline">Modules</Link>.
      </Alert>

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      {(creating || editing) && (
        <AreaForm
          editing={editing}
          initial={formInitial}
          modules={modules}
          areaCodes={areaCodes}
          onSaved={(list, msg) => {
            setAreas(list);
            setMessage(msg);
            closeForm();
          }}
          onCancel={closeForm}
        />
      )}

      {!areas ? (
        !error && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {areas.map((a) => (
            <Card key={a.code} className={a.is_active ? '' : 'opacity-70'}>
              <CardContent className="space-y-3 pt-5">
                <div className="flex items-start gap-3">
                  <span className="mt-1 h-4 w-4 shrink-0 rounded-full" style={{ backgroundColor: a.color }} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{a.name_en}</p>
                      {!a.is_active && <Badge variant="outline">Hidden</Badge>}
                      {a.module_stopped && <Badge variant="warning">Module stopped</Badge>}
                    </div>
                    {a.name_bn && <p className="text-sm text-muted">{a.name_bn}</p>}
                    <p className="mt-0.5 font-mono text-xs text-muted">
                      {a.code}
                      {a.legacy_codes.length > 0 && <> · also {a.legacy_codes.join(', ')}</>}
                    </p>
                    {a.description_en && <p className="mt-1 line-clamp-2 text-sm text-foreground">{a.description_en}</p>}
                  </div>
                  <span className="text-xs text-muted">#{a.sort_order}</span>
                </div>
                <p className="text-xs text-muted">
                  {a.usage.tagged_tasks} tagged task{a.usage.tagged_tasks === 1 ? '' : 's'} · {a.usage.legacy_tasks} module task
                  {a.usage.legacy_tasks === 1 ? '' : 's'} · {a.usage.toolkit} toolkit item{a.usage.toolkit === 1 ? '' : 's'} ·{' '}
                  {a.usage.circulars} circular{a.usage.circulars === 1 ? '' : 's'} · {a.usage.links} link{a.usage.links === 1 ? '' : 's'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/workflow/admin?area=${a.code}`}>
                      <ListChecks className="h-3.5 w-3.5" /> Add task
                    </Link>
                  </Button>
                  <Button size="sm" variant="outline" asChild>
                    <Link href={`/admin/ibas-links?area=${a.code}`}>
                      <Link2 className="h-3.5 w-3.5" /> Links
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" asChild>
                    <Link href={`/ibas?area=${a.code}`} target="_blank">
                      <ExternalLink className="h-3.5 w-3.5" /> Preview
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busyCode === a.code} onClick={() => void toggleVisible(a)}>
                    {a.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    {a.is_active ? 'Hide' : 'Show'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
