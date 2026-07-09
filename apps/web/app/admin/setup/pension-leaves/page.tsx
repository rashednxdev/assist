'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Settings, Plus, Trash2 } from 'lucide-react';
import { PENSION_LEAVE_DEDUCTION_RULES, PENSION_LEAVE_PAY_CATEGORIES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { DEDUCTION_RULE_LABELS, PAY_CATEGORY_LABELS } from '@/lib/pension-labels';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface LeaveTypeRow {
  id: string;
  code: string;
  name_en: string;
  name_bn?: string;
  description_en?: string;
  pay_category: (typeof PENSION_LEAVE_PAY_CATEGORIES)[number];
  deduction_rule: (typeof PENSION_LEAVE_DEDUCTION_RULES)[number];
  sort_order: number;
  is_active: boolean;
  is_auto_entitlement?: boolean;
  entitlement_days_per_cycle?: number;
  entitlement_cycle_years?: number;
  allowance_basic_months?: number;
}

const emptyForm = {
  code: '',
  name_en: '',
  name_bn: '',
  description_en: '',
  pay_category: 'average_salary' as const,
  deduction_rule: 'none' as const,
  sort_order: 0,
  is_auto_entitlement: false,
  entitlement_days_per_cycle: '' as string | number,
  entitlement_cycle_years: '' as string | number,
  allowance_basic_months: '' as string | number,
};

export default function PensionLeavesAdminPage() {
  const [rows, setRows] = useState<LeaveTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await apiFetch<{ data: LeaveTypeRow[] }>('/pension/leave-types?all=true');
      setRows(res.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const payload = {
        ...form,
        entitlement_days_per_cycle: form.entitlement_days_per_cycle
          ? Number(form.entitlement_days_per_cycle)
          : undefined,
        entitlement_cycle_years: form.entitlement_cycle_years
          ? Number(form.entitlement_cycle_years)
          : undefined,
        allowance_basic_months: form.allowance_basic_months
          ? Number(form.allowance_basic_months)
          : undefined,
      };
      if (editingId) {
        await apiFetch(`/pension/leave-types/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setMessage('Leave type updated.');
      } else {
        await apiFetch('/pension/leave-types', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setMessage('Leave type created.');
      }
      setForm(emptyForm);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this leave type?')) return;
    await apiFetch(`/pension/leave-types/${id}`, { method: 'DELETE' });
    await load();
  }

  function startEdit(row: LeaveTypeRow) {
    setEditingId(row.id);
    setForm({
      code: row.code,
      name_en: row.name_en,
      name_bn: row.name_bn ?? '',
      description_en: row.description_en ?? '',
      pay_category: row.pay_category,
      deduction_rule: row.deduction_rule,
      sort_order: row.sort_order,
      is_auto_entitlement: row.is_auto_entitlement ?? false,
      entitlement_days_per_cycle: row.entitlement_days_per_cycle ?? '',
      entitlement_cycle_years: row.entitlement_cycle_years ?? '',
      allowance_basic_months: row.allowance_basic_months ?? '',
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Pension leave types"
        description="Configure leave categories used in the pension leave account calculator."
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/pension">
              <Settings className="h-4 w-4" />
              Open calculator
            </Link>
          </Button>
        }
      />

      {error ? <Alert variant="error">{error}</Alert> : null}
      {message ? <Alert variant="success">{message}</Alert> : null}

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit leave type' : 'Add leave type'}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              value={form.code}
              disabled={!!editingId}
              placeholder="EARNED_LEAVE"
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sort_order">Sort order</Label>
            <Input
              id="sort_order"
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name_en">Name (English)</Label>
            <Input
              id="name_en"
              value={form.name_en}
              onChange={(e) => setForm({ ...form, name_en: e.target.value })}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="name_bn">Name (Bengali)</Label>
            <Input
              id="name_bn"
              value={form.name_bn}
              onChange={(e) => setForm({ ...form, name_bn: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay_category">Leave account</Label>
            <select
              id="pay_category"
              className="ibas-select"
              value={form.pay_category}
              onChange={(e) =>
                setForm({
                  ...form,
                  pay_category: e.target.value as typeof form.pay_category,
                })
              }
            >
              {PENSION_LEAVE_PAY_CATEGORIES.map((v) => (
                <option key={v} value={v}>
                  {PAY_CATEGORY_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="deduction_rule">Service deduction rule</Label>
            <select
              id="deduction_rule"
              className="ibas-select"
              value={form.deduction_rule}
              onChange={(e) =>
                setForm({
                  ...form,
                  deduction_rule: e.target.value as typeof form.deduction_rule,
                })
              }
            >
              {PENSION_LEAVE_DEDUCTION_RULES.map((v) => (
                <option key={v} value={v}>
                  {DEDUCTION_RULE_LABELS[v]}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="description_en">Description</Label>
            <Input
              id="description_en"
              value={form.description_en}
              onChange={(e) => setForm({ ...form, description_en: e.target.value })}
            />
          </div>
          <div className="flex items-center gap-2 sm:col-span-2">
            <input
              id="is_auto_entitlement"
              type="checkbox"
              checked={form.is_auto_entitlement}
              onChange={(e) => setForm({ ...form, is_auto_entitlement: e.target.checked })}
            />
            <Label htmlFor="is_auto_entitlement">Auto-calculated entitlement (e.g. REST leave)</Label>
          </div>
          {form.is_auto_entitlement ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="entitlement_days_per_cycle">Days per cycle</Label>
                <Input
                  id="entitlement_days_per_cycle"
                  type="number"
                  min={1}
                  placeholder="15"
                  value={form.entitlement_days_per_cycle}
                  onChange={(e) => setForm({ ...form, entitlement_days_per_cycle: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="entitlement_cycle_years">Cycle (years)</Label>
                <Input
                  id="entitlement_cycle_years"
                  type="number"
                  min={1}
                  placeholder="3"
                  value={form.entitlement_cycle_years}
                  onChange={(e) => setForm({ ...form, entitlement_cycle_years: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="allowance_basic_months">Allowance (months of basic salary per cycle)</Label>
                <Input
                  id="allowance_basic_months"
                  type="number"
                  min={1}
                  step={0.5}
                  placeholder="1"
                  value={form.allowance_basic_months}
                  onChange={(e) => setForm({ ...form, allowance_basic_months: e.target.value })}
                />
              </div>
            </>
          ) : null}
          <div className="flex gap-2 sm:col-span-2">
            <Button disabled={saving || !form.code || !form.name_en} onClick={() => void save()}>
              {saving ? 'Saving…' : editingId ? 'Update' : 'Add leave type'}
            </Button>
            {editingId ? (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Configured leave types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted">No leave types yet. Run seed or add above.</p>
          ) : (
            rows.map((row) => (
              <div
                key={row.id}
                className={`rounded-lg border p-4 ${row.is_active ? 'border-border' : 'border-dashed opacity-60'}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="font-medium">{row.name_en}</div>
                    {row.name_bn ? <div className="text-sm text-muted">{row.name_bn}</div> : null}
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge variant="outline">{row.code}</Badge>
                      <Badge variant="secondary">{PAY_CATEGORY_LABELS[row.pay_category]}</Badge>
                      {row.is_auto_entitlement ? <Badge>Auto-calculated</Badge> : null}
                    </div>
                    <p className="mt-2 text-sm text-muted">{DEDUCTION_RULE_LABELS[row.deduction_rule]}</p>
                    {row.is_auto_entitlement ? (
                      <p className="mt-1 text-xs text-muted">
                        {row.entitlement_days_per_cycle ?? 15} days every {row.entitlement_cycle_years ?? 3} years;
                        allowance {row.allowance_basic_months ?? 1} month(s) basic per cycle
                      </p>
                    ) : null}
                    {row.description_en ? (
                      <p className="mt-1 text-xs text-muted">{row.description_en}</p>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => startEdit(row)}>
                      Edit
                    </Button>
                    {row.is_active ? (
                      <Button size="sm" variant="ghost" onClick={() => void deactivate(row.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
