'use client';

import { useEffect, type ReactNode } from 'react';

/** Blocks selecting, copying, and the context menu on learner reading surfaces. */
export function CopyGuard({ children }: { children: ReactNode }) {
  useEffect(() => {
    function block(event: Event) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
      event.preventDefault();
    }
    document.addEventListener('copy', block);
    document.addEventListener('cut', block);
    document.addEventListener('contextmenu', block);
    document.addEventListener('dragstart', block);
    return () => {
      document.removeEventListener('copy', block);
      document.removeEventListener('cut', block);
      document.removeEventListener('contextmenu', block);
      document.removeEventListener('dragstart', block);
    };
  }, []);

  return (
    <div
      className="select-none [&_input]:select-text [&_textarea]:select-text [&_[contenteditable=true]]:select-text"
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onContextMenu={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, select, [contenteditable="true"]')) return;
        e.preventDefault();
      }}
    >
      {children}
    </div>
  );
}
