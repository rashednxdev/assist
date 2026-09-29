'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { BD_WEEKEND_DAYS, WEEKDAY_LABELS, type ScheduleOccurrence } from '@ibas/shared-types';
import { monthTitle } from '@/lib/schedule-format';
import { useScheduleTypes } from '@/lib/use-schedule-types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const pad = (n: number) => String(n).padStart(2, '0');

export function monthRange(year: number, month: number): { from: string; to: string } {
  const first = new Date(Date.UTC(year, month, 1));
  const start = new Date(first.getTime() - first.getUTCDay() * 86_400_000);
  const end = new Date(start.getTime() + 41 * 86_400_000);
  const fmt = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { from: fmt(start), to: fmt(end) };
}

export function MonthCalendar({
  year,
  month,
  items,
  today,
  selected,
  onSelect,
  onNavigate,
}: {
  year: number;
  month: number;
  items: ScheduleOccurrence[];
  today: string;
  selected: string | null;
  onSelect: (date: string) => void;
  onNavigate: (delta: number) => void;
}) {
  const { typeColor } = useScheduleTypes();
  const { from } = monthRange(year, month);
  const start = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const byDate = new Map<string, ScheduleOccurrence[]>();
  for (const o of items) byDate.set(o.date, [...(byDate.get(o.date) ?? []), o]);

  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start + i * 86_400_000);
    const key = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    return { key, day: d.getUTCDate(), inMonth: d.getUTCMonth() === month, weekday: d.getUTCDay() };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => onNavigate(-1)} aria-label="Previous month">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <p className="font-semibold">{monthTitle(year, month)}</p>
        <Button variant="ghost" size="sm" onClick={() => onNavigate(1)} aria-label="Next month">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-xs">
        {WEEKDAY_LABELS.map((w, idx) => (
          <div
            key={w}
            className={cn('bg-slate-50 py-1.5 text-center font-medium', (BD_WEEKEND_DAYS as readonly number[]).includes(idx) ? 'text-red-600' : 'text-muted')}
          >
            {w}
          </div>
        ))}
        {cells.map((c) => {
          const list = byDate.get(c.key) ?? [];
          const weekend = (BD_WEEKEND_DAYS as readonly number[]).includes(c.weekday);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onSelect(c.key)}
              className={cn(
                'flex min-h-[4.5rem] flex-col items-stretch gap-0.5 bg-background p-1 text-left align-top hover:bg-slate-50 sm:min-h-[6rem]',
                !c.inMonth && 'bg-slate-50/60 text-muted',
                weekend && c.inMonth && 'bg-red-50/30',
                selected === c.key && 'ring-2 ring-inset ring-primary',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-5 w-5 items-center justify-center self-start rounded-full text-[11px]',
                  c.key === today && 'bg-primary font-semibold text-primary-foreground',
                  weekend && c.key !== today && 'text-red-600',
                )}
              >
                {c.day}
              </span>
              {list.slice(0, 3).map((o, idx) => (
                <span
                  key={`${o.event_id}-${idx}`}
                  className={cn(
                    'hidden truncate rounded px-1 py-px text-[10px] leading-tight text-white sm:block',
                    o.status === 'cancelled' && 'line-through opacity-50',
                  )}
                  style={{ background: typeColor(o.kind) }}
                  title={o.status === 'cancelled' ? 'Cancelled' : o.status === 'postponed' ? 'Postponed' : undefined}
                >
                  {o.status === 'postponed' ? '↻ ' : ''}
                  {o.title}
                </span>
              ))}
              {list.length > 0 && (
                <span className="flex gap-0.5 sm:hidden">
                  {list.slice(0, 4).map((o, idx) => (
                    <span key={`${o.event_id}-${idx}`} className={cn('h-1.5 w-1.5 rounded-full', o.status === 'cancelled' && 'opacity-40')} style={{ background: typeColor(o.kind) }} />
                  ))}
                </span>
              )}
              {list.length > 3 && <span className="hidden text-[10px] text-muted sm:block">+{list.length - 3} more</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
