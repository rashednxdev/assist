'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Building2, ChevronDown, ChevronRight, Globe, Mail, MapPin, Pencil, Phone, Plus, Search, Trash2, Users } from 'lucide-react';
import type { OfficeRecord, OfficeTypeRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { OfficeForm } from '@/components/org/office-form';

type Editing = { office: OfficeRecord | null; parent: OfficeRecord | null } | null;

function OfficeRow({
  o,
  depth,
  hasChildren,
  expanded,
  onToggle,
  onEdit,
  onAddChild,
  onDelete,
  showPath,
}: {
  o: OfficeRecord;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onAddChild: () => void;
  onDelete: () => void;
  showPath?: boolean;
}) {
  const contact = [
    o.email && { icon: Mail, text: o.email },
    (o.telephone || o.mobile) && { icon: Phone, text: [o.telephone, o.mobile].filter(Boolean).join(' · ') + (o.pabx ? ` · PABX ${o.pabx}` : '') },
    o.web_address && { icon: Globe, text: o.web_address.replace(/^https?:\/\//, '') },
    (o.thana_name || o.district_name || o.division_name) && {
      icon: MapPin,
      text: [o.thana_name, o.district_name, o.division_name].filter(Boolean).join(', '),
    },
  ].filter(Boolean) as Array<{ icon: typeof Mail; text: string }>;

  return (
    <div className={cn('group flex items-start gap-2 border-b border-border px-3 py-2.5 last:border-0 hover:bg-slate-50/70', !o.is_active && 'opacity-60')} style={{ paddingLeft: 12 + depth * 22 }}>
      <button
        type="button"
        onClick={onToggle}
        disabled={!hasChildren}
        className={cn('mt-0.5 rounded p-0.5 text-muted', hasChildren ? 'hover:bg-slate-200' : 'invisible')}
        aria-label={expanded ? 'Collapse' : 'Expand'}
      >
        {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      <Building2 className={cn('mt-0.5 h-4 w-4 shrink-0', depth === 0 ? 'text-primary' : 'text-muted')} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{o.name}</span>
          {o.short_name && <span className="text-sm text-muted">({o.short_name})</span>}
          {o.office_type && <Badge variant="outline">{o.office_type.short_name}</Badge>}
          {o.office_code && <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">{o.office_code}</span>}
          {!o.is_active && <Badge variant="secondary">Off</Badge>}
        </div>
        {showPath && o.parent_path && <p className="text-xs text-muted">Under {o.parent_path}</p>}
        {contact.length > 0 && (
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
            {contact.map((c) => (
              <span key={c.text} className="inline-flex items-center gap-1">
                <c.icon className="h-3 w-3" />
                {c.text}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {o.child_count > 0 && <span className="hidden text-xs text-muted sm:inline">{o.child_count} sub</span>}
        {o.user_count > 0 && (
          <span className="hidden items-center gap-0.5 text-xs text-muted sm:inline-flex" title="Users in this office">
            <Users className="h-3 w-3" /> {o.user_count}
          </span>
        )}
        <Button size="sm" variant="ghost" onClick={onAddChild} title="Add sub-office">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden lg:inline">Sub-office</span>
        </Button>
        <Button size="sm" variant="ghost" onClick={onEdit} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={onDelete}
          disabled={o.child_count > 0 || o.user_count > 0}
          title={o.child_count > 0 ? 'Has sub-offices' : o.user_count > 0 ? 'Has users — turn it off instead' : 'Delete'}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

export function OfficesAdmin() {
  const [offices, setOffices] = useState<OfficeRecord[] | null>(null);
  const [types, setTypes] = useState<OfficeTypeRecord[]>([]);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showInactive, setShowInactive] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<Editing>(null);
  const [error, setError] = useState('');

  const load = useCallback(() => {
    Promise.all([
      apiFetch<{ data: OfficeRecord[] }>('/org/admin/offices?include_inactive=true'),
      apiFetch<{ data: OfficeTypeRecord[] }>('/org/office-types?all=true'),
    ])
      .then(([o, t]) => {
        setOffices(o.data);
        setTypes(t.data);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Could not load offices');
        setOffices([]);
      });
  }, []);

  useEffect(load, [load]);

  const children = useMemo(() => {
    const map = new Map<string, OfficeRecord[]>();
    for (const o of offices ?? []) {
      const key = o.parent_id && offices?.some((p) => p.id === o.parent_id) ? o.parent_id : '';
      map.set(key, [...(map.get(key) ?? []), o]);
    }
    return map;
  }, [offices]);

  const filtering = Boolean(q.trim() || typeFilter || !showInactive);
  const flat = useMemo(() => {
    if (!offices || !filtering) return [];
    const term = q.trim().toLowerCase();
    return offices.filter(
      (o) =>
        (showInactive || o.is_active) &&
        (!typeFilter || o.office_type?.id === typeFilter) &&
        (!term || `${o.name} ${o.name_bn ?? ''} ${o.short_name ?? ''} ${o.office_code ?? ''} ${o.email ?? ''} ${o.parent_path}`.toLowerCase().includes(term)),
    );
  }, [offices, filtering, q, typeFilter, showInactive]);

  async function remove(o: OfficeRecord) {
    if (!window.confirm(`Delete office “${o.name}”?`)) return;
    setError('');
    try {
      await apiFetch(`/org/admin/offices/${o.id}`, { method: 'DELETE' });
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
    }
  }

  function toggle(id: string) {
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderTree(parentKey: string, depth: number): React.ReactNode[] {
    return (children.get(parentKey) ?? []).flatMap((o) => {
      const kids = children.get(o.id) ?? [];
      const expanded = !collapsed.has(o.id);
      return [
        <OfficeRow
          key={o.id}
          o={o}
          depth={depth}
          hasChildren={kids.length > 0}
          expanded={expanded}
          onToggle={() => toggle(o.id)}
          onEdit={() => setEditing({ office: o, parent: null })}
          onAddChild={() => setEditing({ office: null, parent: o })}
          onDelete={() => remove(o)}
        />,
        ...(expanded ? renderTree(o.id, depth + 1) : []),
      ];
    });
  }

  const activeTypes = types.filter((t) => t.is_active);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name, short name, code, email…" />
        </div>
        <select className="ibas-select h-10 w-auto min-w-[11rem]" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Office type">
          <option value="">All office types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 px-1 text-sm">
          <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
          Show inactive
        </label>
        <Button onClick={() => setEditing({ office: null, parent: null })} disabled={activeTypes.length === 0}>
          <Plus className="h-4 w-4" /> Add office
        </Button>
      </div>

      {activeTypes.length === 0 && offices !== null && (
        <Alert variant="info" title="Add an office type first">
          Every office needs a type (e.g. Ministry, DAO, UAO). Create one in the Office types tab.
        </Alert>
      )}
      {error && <Alert variant="error">{error}</Alert>}

      {offices === null ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : offices.length === 0 ? (
        <EmptyState title="No offices yet" description="Add a top-level office first, then add its sub-offices." />
      ) : filtering ? (
        flat.length === 0 ? (
          <EmptyState title="No office matches" description="Try another search or clear the filters." />
        ) : (
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
            {flat.map((o) => (
              <OfficeRow
                key={o.id}
                o={o}
                depth={0}
                hasChildren={false}
                expanded={false}
                showPath
                onToggle={() => undefined}
                onEdit={() => setEditing({ office: o, parent: null })}
                onAddChild={() => setEditing({ office: null, parent: o })}
                onDelete={() => remove(o)}
              />
            ))}
          </div>
        )
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">{renderTree('', 0)}</div>
      )}

      {offices && offices.length > 0 && (
        <p className="text-xs text-muted">
          {offices.length} offices · {offices.filter((o) => !o.parent_id).length} top-level
        </p>
      )}

      {editing && (
        <OfficeForm
          office={editing.office}
          parent={editing.parent}
          offices={offices ?? []}
          types={types}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}
