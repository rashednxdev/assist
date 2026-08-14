'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
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
  name?: string;
  rule_number?: string;
  description?: string;
  note?: string;
  is_amended: boolean;
  chapter?: { id: string; name: string; chapter_number?: string } | null;
  details: Array<{ id: string; detail_text: string }>;
  sub_topics: Array<{ id: string; name?: string; rule_number?: string; description?: string; note?: string }>;
  regulations: Array<{ id: string; regulation_no: string; title: string }>;
}

interface ChapterMeta {
  id: string;
  name: string;
  sub_name?: string;
  chapter_number?: string;
  description?: string;
  book_parts_id?: string;
}

interface SubTopicDetail {
  id: string;
  name?: string;
  rule_number?: string;
  description?: string;
  note?: string;
}

interface ChapterDetail {
  id: string;
  name: string;
  sub_name?: string;
  chapter_number?: string;
  description?: string;
}

type Selection =
  | { kind: 'topic'; data: TopicDetail }
  | { kind: 'sub_topic'; data: SubTopicDetail }
  | { kind: 'chapter'; data: ChapterDetail };

function nodeIcon(type: TreeNode['type']) {
  if (type === 'chapter' || type === 'part') return BookOpen;
  return FileText;
}

function topicHeading(ruleNumber?: string, name?: string) {
  const no = ruleNumber?.trim();
  const title = name?.trim();
  if (no && title) return `Rule ${no}: ${title}`;
  if (no) return `Rule ${no}`;
  return title || 'Rule';
}

function subTopicHeading(st: { rule_number?: string; name?: string }) {
  const no = st.rule_number?.trim();
  const title = st.name?.trim();
  if (no && title) return `${no} — ${title}`;
  return no || title || 'Sub-rule';
}

function treeNodeLabel(node: TreeNode) {
  if (node.type === 'sub_topic') return subTopicHeading(node);
  if (node.rule_number) {
    const title = node.name?.trim();
    return title ? `${node.rule_number} — ${title}` : node.rule_number;
  }
  return node.name;
}

function DetailsBlock({ html, note }: { html?: string; note?: string }) {
  const hasDetails = Boolean(html?.trim());
  const hasNote = Boolean(note?.trim());

  if (!hasDetails && !hasNote) {
    return <p className="text-sm text-muted">No details entered for this item.</p>;
  }

  return (
    <div className="space-y-3">
      {hasDetails && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted">Details</h4>
          <RichTextView html={html} />
        </div>
      )}
      {hasNote && (
        <div>
          <h4 className="mb-2 text-sm font-semibold text-muted">Note</h4>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{note}</p>
        </div>
      )}
    </div>
  );
}

export function BookTree({
  bookId: _bookId,
  initialNodes,
  focusChapterId,
  focusTopicId,
}: {
  bookId: string;
  initialNodes: TreeNode[];
  focusChapterId?: string | null;
  focusTopicId?: string | null;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [loadedChildren, setLoadedChildren] = useState<Record<string, TreeNode[]>>({});
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const deepLinkKey = useRef<string | null>(null);

  const loadChildren = useCallback(async (nodeId: string, type: 'part' | 'chapter' | 'topic') => {
    const res = await apiFetch<{ data: { children: TreeNode[] } }>(
      `/books/children?type=${type}&id=${nodeId}`,
    );
    setLoadedChildren((prev) => ({ ...prev, [nodeId]: res.data.children }));
    return res.data.children;
  }, []);

  const expandToChapter = useCallback(
    async (chapter: ChapterMeta) => {
      if (chapter.book_parts_id) {
        setExpanded((prev) => ({ ...prev, [chapter.book_parts_id!]: true }));
        await loadChildren(chapter.book_parts_id, 'part');
      }
      setExpanded((prev) => ({ ...prev, [chapter.id]: true }));
      await loadChildren(chapter.id, 'chapter');
    },
    [loadChildren],
  );

  const toggle = useCallback(
    async (node: TreeNode) => {
      const key = node.id;
      const isOpen = expanded[key];

      if (!isOpen && node.has_children && !node.children?.length && !loadedChildren[key]) {
        const parentType = node.type === 'part' || node.type === 'chapter' || node.type === 'topic' ? node.type : null;
        if (parentType) {
          setLoadingId(key);
          try {
            await loadChildren(key, parentType);
          } finally {
            setLoadingId(null);
          }
        }
      }

      setExpanded((prev) => ({ ...prev, [key]: !isOpen }));
    },
    [expanded, loadedChildren, loadChildren],
  );

  async function selectTopicById(topicId: string) {
    setLoadingDetail(true);
    try {
      const res = await apiFetch<{ data: TopicDetail }>(`/books/topics/${topicId}`);
      setSelection({ kind: 'topic', data: res.data });
    } finally {
      setLoadingDetail(false);
    }
  }

  async function selectNode(node: TreeNode) {
    if (node.type === 'chapter') {
      setSelection({
        kind: 'chapter',
        data: {
          id: node.id,
          name: node.name,
          sub_name: node.sub_name,
          chapter_number: node.chapter_number,
          description: node.description,
        },
      });
      return;
    }

    if (node.type === 'sub_topic') {
      setLoadingDetail(true);
      try {
        const res = await apiFetch<{ data: SubTopicDetail }>(`/books/sub-topics/${node.id}`);
        setSelection({ kind: 'sub_topic', data: res.data });
      } catch {
        setSelection({
          kind: 'sub_topic',
          data: {
            id: node.id,
            name: node.name,
            rule_number: node.rule_number,
            description: node.description,
            note: node.note,
          },
        });
      } finally {
        setLoadingDetail(false);
      }
      return;
    }

    if (node.type === 'topic') {
      await selectTopicById(node.id);
    }
  }

  useEffect(() => {
    const key = `${focusChapterId ?? ''}:${focusTopicId ?? ''}`;
    if (!focusChapterId && !focusTopicId) return;
    if (deepLinkKey.current === key) return;
    deepLinkKey.current = key;

    let cancelled = false;

    async function runDeepLink() {
      setLoadingDetail(true);
      try {
        if (focusTopicId) {
          const topicRes = await apiFetch<{ data: TopicDetail }>(`/books/topics/${focusTopicId}`);
          if (cancelled) return;
          const chapterId = topicRes.data.chapter?.id;
          if (chapterId) {
            const chapterRes = await apiFetch<{ data: ChapterMeta }>(`/books/chapters/${chapterId}`);
            if (cancelled) return;
            await expandToChapter(chapterRes.data);
          }
          if (!cancelled) setSelection({ kind: 'topic', data: topicRes.data });
          return;
        }

        if (focusChapterId) {
          const chapterRes = await apiFetch<{ data: ChapterMeta }>(`/books/chapters/${focusChapterId}`);
          if (cancelled) return;
          await expandToChapter(chapterRes.data);
          if (!cancelled) {
            setSelection({
              kind: 'chapter',
              data: {
                id: chapterRes.data.id,
                name: chapterRes.data.name,
                sub_name: chapterRes.data.sub_name,
                chapter_number: chapterRes.data.chapter_number,
                description: chapterRes.data.description,
              },
            });
          }
        }
      } finally {
        if (!cancelled) setLoadingDetail(false);
      }
    }

    runDeepLink();
    return () => {
      cancelled = true;
    };
  }, [focusChapterId, focusTopicId, expandToChapter]);

  function renderNodes(nodes: TreeNode[], depth = 0) {
    return nodes.map((node) => {
      const Icon = nodeIcon(node.type);
      const children = node.children?.length ? node.children : loadedChildren[node.id] ?? [];
      const isOpen = expanded[node.id];
      const isSelectable = node.type === 'topic' || node.type === 'sub_topic' || node.type === 'chapter';
      const canExpand = node.has_children || node.type !== 'sub_topic';

      return (
        <div key={node.id}>
          <div
            className={`flex items-start gap-1 rounded-lg py-1.5 pr-2 hover:bg-slate-50 ${isSelectable ? 'cursor-pointer' : ''}`}
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
                if (isSelectable) selectNode(node);
                else if (canExpand) toggle(node);
              }}
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="font-medium text-foreground">
                  {node.chapter_number && (
                    <span className="text-muted">
                      Ch. {node.chapter_number}
                      {treeNodeLabel(node) ? ' · ' : ''}
                    </span>
                  )}
                  {treeNodeLabel(node)}
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

  function renderDetailPanel() {
    if (loadingDetail) {
      return (
        <div className="space-y-3">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-20 w-full" />
        </div>
      );
    }

    if (!selection) {
      return <p className="text-sm text-muted">Select a chapter, rule, or sub-rule in the tree to view its details.</p>;
    }

    if (selection.kind === 'chapter') {
      const ch = selection.data;
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">
            {ch.chapter_number
              ? `Chapter ${ch.chapter_number}${ch.name?.trim() ? `: ${ch.name}` : ''}`
              : ch.name?.trim() || 'Chapter'}
          </h3>
          {ch.sub_name && <p className="text-sm text-muted">{ch.sub_name}</p>}
          <DetailsBlock html={ch.description} />
        </div>
      );
    }

    if (selection.kind === 'sub_topic') {
      const st = selection.data;
      return (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{subTopicHeading(st)}</h3>
          <DetailsBlock html={st.description} note={st.note} />
        </div>
      );
    }

    const topic = selection.data;
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-lg font-semibold">{topicHeading(topic.rule_number, topic.name)}</h3>
          {topic.is_amended && <Badge variant="warning">Amended</Badge>}
        </div>
        <DetailsBlock html={topic.description} note={topic.note} />
        {topic.details.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-muted">Additional detail blocks</h4>
            <div className="space-y-3">
              {topic.details.map((d) => (
                <RichTextView key={d.id} html={d.detail_text} />
              ))}
            </div>
          </div>
        )}
        {topic.sub_topics.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-muted">Sub-rules</h4>
            <ul className="space-y-2">
              {topic.sub_topics.map((st) => (
                <li key={st.id} className="rounded-lg border border-border bg-slate-50/80 p-3 text-sm">
                  <button
                    type="button"
                    className="font-medium text-left text-primary hover:underline"
                    onClick={() =>
                      setSelection({
                        kind: 'sub_topic',
                        data: {
                          id: st.id,
                          name: st.name,
                          rule_number: st.rule_number,
                          description: st.description,
                          note: st.note,
                        },
                      })
                    }
                  >
                    {subTopicHeading(st)}
                  </button>
                  <RichTextView html={st.description} className="mt-2" />
                </li>
              ))}
            </ul>
          </div>
        )}
        {topic.regulations.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-muted">Linked regulations</h4>
            <ul className="space-y-1">
              {topic.regulations.map((r) => (
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
    );
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

      <div className="rounded-xl border border-border bg-surface p-4">{renderDetailPanel()}</div>
    </div>
  );
}
