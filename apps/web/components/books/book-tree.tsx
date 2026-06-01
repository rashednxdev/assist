'use client';

import { useState, useCallback } from 'react';
import { ChevronRight, ChevronDown, FileText, BookOpen, ListTree } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { RichTextView } from '@/components/books/rich-text-view';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface TreeNode {
  type: 'part' | 'chapter' | 'topic' | 'sub_topic';
  id: string;
  name: string;
  sub_name?: string;
  chapter_number?: string;
  rule_number?: string;
  description?: string;
  note?: string;
  is_amended?: boolean;
  part_number?: number;
  has_children?: boolean;
  children?: TreeNode[];
  details?: Array<{ id: string; detail_text: string }>;
}

interface TopicDetail {
  id: string;
  name: string;
  rule_number: string;
  description?: string;
  note?: string;
  is_amended: boolean;
  details: Array<{ id: string; detail_text: string }>;
  sub_topics: Array<{ id: string; name: string; rule_number?: string; description?: string }>;
  regulations: Array<{ id: string; regulation_no: string; title: string }>;
}

function nodeIcon(type: TreeNode['type']) {
  if (type === 'chapter' || type === 'part') return BookOpen;
  return FileText;
}

export function BookTree({ bookId, initialNodes }: { bookId: string; initialNodes: TreeNode[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadedChildren, setLoadedChildren] = useState<Record<string, TreeNode[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicDetail | null>(null);
  const [loadingTopic, setLoadingTopic] = useState(false);

  const toggle = useCallback(
    async (node: TreeNode) => {
      const key = node.id;
      const isOpen = expanded[key];

      if (!isOpen && node.has_children && !node.children?.length && !loadedChildren[key]) {
        const parentType = node.type === 'part' || node.type === 'chapter' || node.type === 'topic' ? node.type : null;
        if (parentType) {
          setLoadingId(key);
          try {
            const res = await apiFetch<{ data: { children: TreeNode[] } }>(
              `/books/children?type=${parentType}&id=${key}`,
            );
            setLoadedChildren((prev) => ({ ...prev, [key]: res.data.children }));
          } finally {
            setLoadingId(null);
          }
        }
      }

      setExpanded((prev) => ({ ...prev, [key]: !isOpen }));
    },
    [expanded, loadedChildren],
  );

  async function selectTopic(topicId: string) {
    setLoadingTopic(true);
    try {
      const res = await apiFetch<{ data: TopicDetail }>(`/books/topics/${topicId}`);
      setSelectedTopic(res.data);
    } finally {
      setLoadingTopic(false);
    }
  }

  function renderNodes(nodes: TreeNode[], depth = 0) {
    return nodes.map((node) => {
      const Icon = nodeIcon(node.type);
      const children = node.children?.length ? node.children : loadedChildren[node.id] ?? [];
      const isOpen = expanded[node.id];
      const canExpand = node.has_children || node.type !== 'sub_topic';
      const isTopic = node.type === 'topic';

      return (
        <div key={node.id}>
          <div
            className={`flex items-start gap-1 rounded-lg py-1.5 pr-2 hover:bg-slate-50 ${isTopic ? 'cursor-pointer' : ''}`}
            style={{ paddingLeft: depth * 16 + 4 }}
          >
            {canExpand ? (
              <button
                type="button"
                className="mt-0.5 shrink-0 rounded p-0.5 text-muted hover:text-foreground"
                onClick={() => toggle(node)}
                aria-label={isOpen ? 'Collapse' : 'Expand'}
              >
                {loadingId === node.id ? (
                  <span className="inline-block h-4 w-4 animate-pulse rounded bg-slate-200" />
                ) : isOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <span className="w-5 shrink-0" />
            )}
            <button
              type="button"
              className="flex min-w-0 flex-1 items-start gap-2 text-left text-sm"
              onClick={() => {
                if (isTopic) selectTopic(node.id);
                else if (canExpand) toggle(node);
              }}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="font-medium text-foreground">
                  {node.chapter_number && <span className="text-muted">{node.chapter_number} · </span>}
                  {node.rule_number && <span className="text-primary">{node.rule_number} · </span>}
                  {node.name}
                </span>
                {node.sub_name && <span className="ml-1 text-xs text-muted">({node.sub_name})</span>}
                {node.is_amended && (
                  <Badge variant="warning" className="ml-2">
                    Amended
                  </Badge>
                )}
              </span>
            </button>
          </div>
          {isOpen && children.length > 0 && <div>{renderNodes(children, depth + 1)}</div>}
        </div>
      );
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <ListTree className="h-4 w-4" />
          Contents
        </div>
        <div className="max-h-[70vh] overflow-y-auto">{renderNodes(initialNodes)}</div>
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        {loadingTopic ? (
          <div className="space-y-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : selectedTopic ? (
          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold">
                  Rule {selectedTopic.rule_number}: {selectedTopic.name}
                </h3>
                {selectedTopic.is_amended && <Badge variant="warning">Amended</Badge>}
              </div>
            </div>
            <RichTextView html={selectedTopic.description} />
            {selectedTopic.note && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{selectedTopic.note}</p>
            )}
            {selectedTopic.details.map((d) => (
              <RichTextView key={d.id} html={d.detail_text} />
            ))}
            {selectedTopic.sub_topics.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-muted">Sub-rules</h4>
                <ul className="space-y-2">
                  {selectedTopic.sub_topics.map((st) => (
                    <li key={st.id} className="rounded-lg border border-border bg-slate-50/80 p-3 text-sm">
                      <span className="font-medium">{st.rule_number ? `${st.rule_number} — ` : ''}{st.name}</span>
                      <RichTextView html={st.description} className="mt-1" />
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {selectedTopic.regulations.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-muted">Linked regulations</h4>
                <ul className="space-y-1">
                  {selectedTopic.regulations.map((r) => (
                    <li key={r.id}>
                      <a href={`/books/regulations/${r.id}`} className="text-sm text-primary hover:underline">
                        {r.regulation_no} — {r.title}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted">Select a rule in the tree to view its full text.</p>
        )}
      </div>
    </div>
  );
}
