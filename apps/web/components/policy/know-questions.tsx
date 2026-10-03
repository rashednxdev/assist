'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, FileText, Search } from 'lucide-react';
import type { ExplanationSection, KnowQuestionItem } from '@ibas/shared-types';
import { cn } from '@/lib/utils';
import { RichTextView } from '@/components/books/rich-text-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function isGenericTitle(title?: string) {
  const t = title?.trim().toLowerCase() ?? '';
  return !t || t === 'explanation' || t === 'explanations' || t === 'answer' || t === 'answers';
}

function AnswerBlocks({ sections }: { sections: ExplanationSection[] }) {
  if (sections.length === 0) return <p className="text-sm text-muted">No answer added yet.</p>;
  return (
    <div className="space-y-3">
      {sections.map((sec, idx) => (
        <div key={idx} className="border-l-2 border-emerald-400 pl-3">
          {!isGenericTitle(sec.title) && <p className="font-semibold">{sec.title}</p>}
          <RichTextView html={sec.details} />
          {sec.note?.trim() ? <RichTextView html={sec.note} className="text-muted" /> : null}
          {(sec.subsections ?? []).map((sub, si) => (
            <div key={si} className="mt-2 pl-2">
              {!isGenericTitle(sub.subtitle) && <p className="text-sm font-semibold">{sub.subtitle}</p>}
              <RichTextView html={sub.details} />
              {sub.note?.trim() ? <RichTextView html={sub.note} className="text-muted" /> : null}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function KnowQuestions({ items }: { items: KnowQuestionItem[] }) {
  const [showAll, setShowAll] = useState(false);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [q, setQ] = useState('');

  const groups = useMemo(() => {
    const term = q.trim().toLowerCase();
    const out: Array<{ key: string; book: string; chapter: string; items: KnowQuestionItem[] }> = [];
    for (const it of items) {
      if (term && !`${it.body_bn ?? ''} ${it.body_en}`.toLowerCase().includes(term)) continue;
      const key = `${it.book_id ?? '-'}:${it.chapter_id ?? '-'}`;
      let g = out.find((x) => x.key === key);
      if (!g) {
        g = { key, book: it.book_name ?? 'Other questions', chapter: it.chapter_label ?? '', items: [] };
        out.push(g);
      }
      g.items.push(it);
    }
    return out;
  }, [items, q]);

  function toggle(id: string) {
    setRevealed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search questions…" className="pl-9" />
        </div>
        <Button size="sm" variant={showAll ? 'default' : 'outline'} onClick={() => setShowAll((v) => !v)}>
          {showAll ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          {showAll ? 'Hide answers' : 'Show all answers'}
        </Button>
      </div>
      <p className="text-xs text-muted">Tap a question to see its answer and any circulars tagged to it.</p>

      {groups.length === 0 ? (
        <p className="text-sm text-muted">No questions match.</p>
      ) : (
        groups.map((g) => (
          <section key={g.key} className="space-y-2">
            <div className="border-b border-border pb-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">{g.book}</p>
              {g.chapter && <h3 className="font-semibold text-emerald-800">{g.chapter}</h3>}
            </div>
            {g.items.map((it) => {
              const open = showAll || revealed.has(it.id);
              return (
                <div key={it.link_id} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
                  <button type="button" onClick={() => toggle(it.id)} className="flex w-full items-start gap-3 text-left">
                    <span className="flex h-7 min-w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 px-1.5 text-xs font-bold text-emerald-800">
                      {it.number}
                    </span>
                    <span className="flex-1 text-sm font-medium leading-relaxed">{it.body_bn?.trim() || it.body_en}</span>
                    {!it.is_published && <Badge variant="warning">Draft</Badge>}
                    {it.circulars.length > 0 && !open && (
                      <FileText className="h-4 w-4 shrink-0 text-indigo-600" aria-label="Has tagged circulars" />
                    )}
                    <span className={cn('text-xs font-semibold', open ? 'text-muted' : 'text-primary')}>
                      {open ? 'Hide' : 'Answer'}
                    </span>
                  </button>
                  {open && (
                    <div className="mt-3 space-y-3 border-t border-border pt-3">
                      <AnswerBlocks sections={it.explanation_sections} />
                      {it.circulars.length > 0 && (
                        <div className="space-y-1.5 rounded-lg bg-indigo-50/60 p-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-800">Related circulars</p>
                          {it.circulars.map((c) => (
                            <Link
                              key={c.id}
                              href={`/circulars/${c.id}`}
                              className="flex items-start gap-2 rounded-md bg-background px-2.5 py-2 text-sm hover:bg-slate-50"
                            >
                              <FileText className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                              <span className="min-w-0 flex-1">
                                <span className="block font-medium">{c.title_bn?.trim() || c.title}</span>
                                <span className="block text-xs text-muted">
                                  {c.circular_no} · {c.issue_date}
                                </span>
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
