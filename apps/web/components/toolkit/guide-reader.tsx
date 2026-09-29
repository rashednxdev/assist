'use client';

import { Printer } from 'lucide-react';
import type { ToolkitItemDetail } from '@ibas/shared-types';
import { RichTextView } from '@/components/books/rich-text-view';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefLinks } from './ref-links';

export function GuideReader({ item }: { item: ToolkitItemDetail }) {
  const sections = item.sections ?? [];
  return (
    <div className="grid gap-6 lg:grid-cols-4">
      <nav className="space-y-1 lg:sticky lg:top-4 lg:self-start print:hidden">
        <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wider text-muted">Contents</p>
        {sections.map((s, i) => (
          <a key={s.id} href={`#sec-${s.id}`} className="block rounded-md px-2 py-1.5 text-sm text-muted hover:bg-slate-100 hover:text-foreground">
            <span className="mr-1.5 text-xs">{i + 1}.</span>
            {s.heading}
          </a>
        ))}
        <Button variant="outline" size="sm" className="mt-3" onClick={() => window.print()}>
          <Printer className="h-4 w-4" /> Print guide
        </Button>
      </nav>
      <div className="space-y-4 lg:col-span-3">
        {sections.map((s, i) => (
          <Card key={s.id} id={`sec-${s.id}`} className="scroll-mt-4 break-inside-avoid print:border-0 print:shadow-none">
            <CardContent className="space-y-3 pt-5">
              <h2 className="flex items-baseline gap-2 text-lg font-semibold text-foreground">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-white">{i + 1}</span>
                {s.heading}
              </h2>
              <RichTextView html={s.body} />
              <RefLinks refs={s.refs} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
