'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ProgressSummary } from './progress-summary';

export interface ProgressNode {
  id: string;
  name: string;
  type: string;
  rule_number?: string;
  progress_percent: number;
  rated_questions: number;
  total_questions: number;
  children?: ProgressNode[];
}

interface ProgressTreeProps {
  node: ProgressNode;
  depth?: number;
}

export function ProgressTree({ node, depth = 0 }: ProgressTreeProps) {
  const hasChildren = (node.children?.length ?? 0) > 0;
  const [open, setOpen] = useState(depth < 2);

  if (node.total_questions === 0 && !hasChildren) return null;

  const label =
    node.rule_number && node.type !== 'book' && node.type !== 'paper'
      ? `${node.rule_number} — ${node.name}`
      : node.name;

  return (
    <div className={depth > 0 ? 'border-l border-border pl-3' : ''}>
      <div className="flex items-start gap-2 py-2">
        {hasChildren ? (
          <button
            type="button"
            className="mt-0.5 text-muted hover:text-foreground"
            onClick={() => setOpen(!open)}
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <span className="w-4" />
        )}
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={depth === 0 ? 'font-semibold' : 'font-medium'}>{label}</span>
            <span className="text-xs capitalize text-muted">{node.type.replace('_', ' ')}</span>
          </div>
          {node.total_questions > 0 ? (
            <ProgressSummary
              percent={node.progress_percent}
              rated={node.rated_questions}
              total={node.total_questions}
              size={depth > 1 ? 'sm' : 'md'}
            />
          ) : (
            <p className="text-xs text-muted">No linked questions</p>
          )}
        </div>
      </div>
      {hasChildren && open && (
        <div className="space-y-1">
          {node.children!.map((child) => (
            <ProgressTree key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
