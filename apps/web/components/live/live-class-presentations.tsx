'use client';

import { useMemo, useState } from 'react';
import {
  hasComparisonTableContent,
  hasProcessContent,
  normalizeLiveStreamPresentations,
  type LiveStreamPresentation,
  type LiveStreamSlide,
} from '@ibas/shared-types';
import { MarkupText } from '@/components/shared/markup-text';
import { ComparisonTableView } from '@/components/questions/comparison-table-view';
import { ProcessFlowPreview } from '@/components/books/process-flow-preview';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface LiveClassPresentationsProps {
  presentations?: LiveStreamPresentation[];
  /** @deprecated Prefer `presentations`. */
  slides?: LiveStreamSlide[];
}

/** Guest view: one or more presentation decks with tabs when multiple. */
export function LiveClassPresentations({ presentations, slides }: LiveClassPresentationsProps) {
  const decks = useMemo(
    () => normalizeLiveStreamPresentations({ presentations, slides }),
    [presentations, slides],
  );
  const [active, setActive] = useState(0);
  const current = decks[Math.min(active, Math.max(decks.length - 1, 0))];

  if (decks.length === 0 || !current) {
    return <p className="text-sm text-muted-foreground">No presentation slides published yet.</p>;
  }

  return (
    <div className="space-y-8">
      <p className="text-center text-xs font-bold uppercase tracking-wide text-pink-800">
        {decks.length > 1
          ? `${decks.length} presentations`
          : `Class presentation · ${current.slides.length} slide${
              current.slides.length === 1 ? '' : 's'
            }`}
      </p>
      {decks.length > 1 ? (
        <div className="flex flex-wrap justify-center gap-2">
          {decks.map((deck, index) => (
            <Button
              key={`deck-${index}-${deck.title}`}
              type="button"
              size="sm"
              variant={index === active ? 'default' : 'outline'}
              onClick={() => setActive(index)}
            >
              {deck.title || `Presentation ${index + 1}`}
            </Button>
          ))}
        </div>
      ) : null}
      {decks.length > 1 ? (
        <p className="text-center text-sm font-semibold text-slate-700">
          {current.title} · {current.slides.length} slide
          {current.slides.length === 1 ? '' : 's'}
        </p>
      ) : null}
      {current.slides.map((slide, index) => (
        <Card key={`slide-${active}-${index}`} className="border-pink-100 shadow-sm">
          <CardContent className="space-y-4 px-6 py-10 sm:px-10">
            <p className="text-center text-xs font-bold text-slate-400">
              {index + 1} / {current.slides.length}
            </p>
            {slide.title?.trim() ? (
              <div className="text-center text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl">
                <MarkupText text={slide.title} />
              </div>
            ) : null}
            {slide.context?.trim() ? (
              <div className="text-base leading-8 text-slate-800 sm:text-lg">
                <MarkupText text={slide.context} />
              </div>
            ) : null}
            {hasComparisonTableContent(slide.table) ? (
              <ComparisonTableView table={slide.table} label="" />
            ) : null}
            {hasProcessContent(slide.process) ? (
              <div className="space-y-3 rounded-xl border border-border bg-slate-50 p-4">
                {slide.process?.title?.trim() ? (
                  <p className="text-lg font-bold text-slate-900">{slide.process.title}</p>
                ) : null}
                {slide.process?.details?.trim() ? (
                  <div className="text-sm text-slate-700">
                    <MarkupText text={slide.process.details} />
                  </div>
                ) : null}
                <ProcessFlowPreview steps={slide.process?.steps ?? []} />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
