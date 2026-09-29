'use client';

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronDown, Copy, Printer, RotateCcw } from 'lucide-react';
import type { ToolkitItemDetail } from '@ibas/shared-types';
import { cn } from '@/lib/utils';
import { formatLongDate, toLocalIsoDate } from '@/lib/date-display';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/alert';
import { RefLinks } from './ref-links';
import { AttachmentLinks } from './attachment-links';

interface SavedRun {
  reference: string;
  checked: string[];
  notes: Record<string, string>;
}

const EMPTY_RUN: SavedRun = { reference: '', checked: [], notes: {} };

export function ChecklistRunner({ item }: { item: ToolkitItemDetail }) {
  const items = useMemo(() => item.items ?? [], [item.items]);
  const storageKey = `toolkit:checklist:${item.id}`;
  const [run, setRun] = useState<SavedRun>(EMPTY_RUN);
  const [loaded, setLoaded] = useState(false);
  const [openHelp, setOpenHelp] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setRun({ ...EMPTY_RUN, ...(JSON.parse(raw) as SavedRun) });
    } catch {
      /* ignore corrupt local data */
    }
    setLoaded(true);
  }, [storageKey]);

  useEffect(() => {
    if (loaded) localStorage.setItem(storageKey, JSON.stringify(run));
  }, [run, loaded, storageKey]);

  const validIds = new Set(items.map((i) => i.id));
  const checked = new Set(run.checked.filter((id) => validIds.has(id)));
  const required = items.filter((i) => i.required);
  const missingRequired = required.filter((i) => !checked.has(i.id));
  const pct = items.length ? Math.round((checked.size / items.length) * 100) : 0;

  const sections = useMemo(() => {
    const out: Array<{ name: string; items: typeof items }> = [];
    for (const it of items) {
      const name = it.section?.trim() || '';
      const last = out[out.length - 1];
      if (last && last.name === name) last.items.push(it);
      else out.push({ name, items: [it] });
    }
    return out;
  }, [items]);

  function toggle(id: string) {
    setRun((r) => ({
      ...r,
      checked: r.checked.includes(id) ? r.checked.filter((x) => x !== id) : [...r.checked, id],
    }));
  }

  async function copyResult() {
    const header = [
      item.title,
      run.reference ? `Reference: ${run.reference}` : '',
      `Date: ${formatLongDate(toLocalIsoDate(new Date()))}`,
      `Completed: ${checked.size}/${items.length}`,
    ].filter(Boolean);
    const lines = items.map((i) => {
      const note = run.notes[i.id]?.trim();
      return `${checked.has(i.id) ? '[x]' : '[ ]'} ${i.text}${i.required ? '' : ' (optional)'}${note ? ` — ${note}` : ''}`;
    });
    await navigator.clipboard.writeText(`${header.join('\n')}\n\n${lines.join('\n')}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  let counter = 0;

  return (
    <div className="space-y-4">
      <Card className="print:border-0 print:shadow-none">
        <CardContent className="space-y-3 pt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[220px] flex-1 space-y-1">
              <label htmlFor="cl-ref" className="text-xs font-medium text-muted">
                Reference (bill no., file no., case name — saved on this device only)
              </label>
              <Input
                id="cl-ref"
                value={run.reference}
                onChange={(e) => setRun((r) => ({ ...r, reference: e.target.value }))}
                placeholder="e.g. Bill #1234 / Contractor X"
                className="print:border-0 print:p-0"
              />
            </div>
            <div className="flex gap-2 print:hidden">
              <Button variant="outline" onClick={() => void copyResult()}>
                <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy result'}
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  if (window.confirm('Clear all ticks, notes and the reference for this checklist?')) setRun(EMPTY_RUN);
                }}
              >
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </div>
          </div>
          <div>
            <div className="mb-1 flex justify-between text-xs text-muted">
              <span>
                {checked.size} of {items.length} done
              </span>
              <span>{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
          {items.length > 0 &&
            (missingRequired.length === 0 ? (
              <Alert variant="success">
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" /> All required items are ticked.
                </span>
              </Alert>
            ) : (
              <p className="text-sm text-amber-700">
                {missingRequired.length} required item{missingRequired.length === 1 ? '' : 's'} still open.
              </p>
            ))}
        </CardContent>
      </Card>

      {sections.map((sec, si) => (
        <Card key={`${sec.name}-${si}`} className="break-inside-avoid print:border-0 print:shadow-none">
          <CardContent className="space-y-1 pt-5">
            {sec.name && <h3 className="pb-2 text-sm font-semibold uppercase tracking-wide text-muted">{sec.name}</h3>}
            {sec.items.map((it) => {
              counter += 1;
              const done = checked.has(it.id);
              const helpOpen = openHelp.has(it.id);
              return (
                <div key={it.id} className={cn('rounded-lg border p-3 transition-colors', done ? 'border-emerald-200 bg-emerald-50/50' : 'border-border')}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id={`cl-${it.id}`}
                      checked={done}
                      onChange={() => toggle(it.id)}
                      className="mt-1 h-4 w-4 shrink-0 accent-emerald-600"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <label htmlFor={`cl-${it.id}`} className={cn('block cursor-pointer text-sm', done && 'text-muted line-through')}>
                        <span className="mr-1 text-muted">{counter}.</span>
                        {it.text}
                        {!it.required && <span className="ml-1.5 text-xs text-muted">(optional)</span>}
                      </label>
                      <RefLinks refs={it.refs} />
                      <AttachmentLinks files={it.attachments ?? []} compact className="print:hidden" />
                      {it.help && (
                        <div className="print:hidden">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs font-medium text-primary"
                            onClick={() =>
                              setOpenHelp((s) => {
                                const n = new Set(s);
                                if (n.has(it.id)) n.delete(it.id);
                                else n.add(it.id);
                                return n;
                              })
                            }
                          >
                            <ChevronDown className={cn('h-3 w-3 transition-transform', helpOpen && 'rotate-180')} />
                            {helpOpen ? 'Hide guidance' : 'How to check'}
                          </button>
                          {helpOpen && <p className="mt-1 whitespace-pre-line rounded bg-slate-50 p-2 text-xs text-foreground">{it.help}</p>}
                        </div>
                      )}
                      <input
                        value={run.notes[it.id] ?? ''}
                        onChange={(e) => setRun((r) => ({ ...r, notes: { ...r.notes, [it.id]: e.target.value } }))}
                        placeholder="Note (optional)"
                        className="w-full rounded border-0 border-b border-dashed border-border bg-transparent px-0 py-0.5 text-xs text-muted focus:border-primary focus:outline-none print:hidden"
                      />
                      {run.notes[it.id]?.trim() && <p className="hidden text-xs text-muted print:block">Note: {run.notes[it.id]}</p>}
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
