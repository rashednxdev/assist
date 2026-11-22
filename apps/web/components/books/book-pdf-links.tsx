'use client';

import { Download, ExternalLink, FileText } from 'lucide-react';

export interface BookPdfLinkItem {
  title: string;
  url: string;
}

/** Learner-facing list of PDF file links attached to a Books & Tools item. */
export function BookPdfLinks({
  links,
  className = '',
  title = 'PDF files',
}: {
  links?: BookPdfLinkItem[] | null;
  className?: string;
  title?: string;
}) {
  const items = (links ?? []).filter((l) => l.title?.trim() && l.url?.trim());
  if (items.length === 0) return null;

  return (
    <div className={`rounded-2xl border border-[#d7e4ee] bg-white p-4 shadow-xs ${className}`}>
      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
        <FileText className="h-3.5 w-3.5 text-[#1566b8]" />
        {title}
      </div>
      <ul className="space-y-2">
        {items.map((link, idx) => (
          <li key={`${link.url}-${idx}`}>
            <a
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-[#eaf0f6] bg-[#f8fbfe] px-3 py-2.5 text-sm font-semibold text-[#0a2f5b] transition hover:border-[#1566b8] hover:bg-[#eaf4fc]"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Download className="h-4 w-4 shrink-0 text-[#1566b8]" />
                <span className="truncate">{link.title}</span>
              </span>
              <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
