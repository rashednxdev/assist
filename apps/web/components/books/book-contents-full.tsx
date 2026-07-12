'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HelpCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BookDetailsBlock } from '@/components/books/book-details-block';
import { RichTextView } from '@/components/books/rich-text-view';
import { RuleContentLinkEmbed } from '@/components/books/rule-content-link-embed';
import {
  ChapterInlineEdit,
  InlineEditTrigger,
  SubTopicInlineEdit,
  TopicInlineEdit,
} from '@/components/books/book-inline-edit';
import type { ReaderChapter } from '@/components/books/book-reader-context';
import { chapterHeading, ruleHeading, subRuleHeading } from '@/lib/book-display';
import { bookTheme } from '@/lib/book-theme';

export interface ReaderTopicFull {
  id: string;
  rule_number: string;
  name?: string;
  sub_name?: string;
  is_amended: boolean;
  sort_order: number;
  description?: string;
  note?: string;
  content_link?: string;
  details: Array<{ id: string; detail_text: string }>;
  sub_topics: Array<{
    id: string;
    name?: string;
    rule_number?: string;
    description?: string;
    note?: string;
  }>;
}

export interface ReaderChapterFull extends Omit<ReaderChapter, 'topics'> {
  topics: ReaderTopicFull[];
}

type EditTarget =
  | { type: 'chapter'; id: string }
  | { type: 'topic'; id: string }
  | { type: 'sub'; id: string }
  | null;

export function BookContentsFull({
  bookId,
  chapters,
  loading,
  isAdmin,
  onManageQuestions,
  onContentChanged,
}: {
  bookId: string;
  chapters: ReaderChapterFull[];
  loading: boolean;
  isAdmin: boolean;
  onManageQuestions: (chapter: ReaderChapter) => void;
  onContentChanged?: () => void;
}) {
  const [editing, setEditing] = useState<EditTarget>(null);

  function toggleEdit(target: Exclude<EditTarget, null>) {
    setEditing((prev) =>
      prev && prev.type === target.type && prev.id === target.id ? null : target,
    );
  }

  function handleSaved() {
    setEditing(null);
    onContentChanged?.();
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (chapters.length === 0) {
    return <p className="text-sm text-muted">No chapters in this book yet.</p>;
  }

  const chapterOptions = chapters.map((c) => ({
    id: c.id,
    chapter_number: c.chapter_number,
    name: c.name,
    sub_name: c.sub_name,
  }));

  return (
    <article className="space-y-10">
      {chapters.map((chapter) => {
        const editingChapter = editing?.type === 'chapter' && editing.id === chapter.id;
        return (
          <section key={chapter.id} id={`chapter-${chapter.id}`} className="scroll-mt-6">
            <div className="flex items-start justify-between gap-2 border-b border-amber-900/10 pb-3">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground">
                  <Link
                    href={`/books/${bookId}/read/chapter/${chapter.id}`}
                    className="hover:text-primary"
                  >
                    {chapterHeading(chapter)}
                  </Link>
                </h3>
                {chapter.sub_name?.trim() && (
                  <p className="mt-0.5 text-sm text-muted">{chapter.sub_name}</p>
                )}
              </div>
              {isAdmin && (
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <InlineEditTrigger
                    label="Edit chapter"
                    active={editingChapter}
                    onClick={() => toggleEdit({ type: 'chapter', id: chapter.id })}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    title="Manage chapter questions"
                    onClick={() => onManageQuestions(chapter)}
                  >
                    <HelpCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Questions</span>
                  </Button>
                </div>
              )}
            </div>

            {editingChapter && (
              <ChapterInlineEdit
                chapterId={chapter.id}
                initial={chapter}
                onCancel={() => setEditing(null)}
                onSaved={handleSaved}
              />
            )}

            {chapter.description?.trim() && !editingChapter && (
              <div className="mt-4">
                <BookDetailsBlock html={chapter.description} />
              </div>
            )}

            {chapter.topics.length > 0 && (
              <div className="mt-6 space-y-6">
                {chapter.topics.map((topic) => {
                  const editingTopic = editing?.type === 'topic' && editing.id === topic.id;
                  return (
                    <div
                      key={topic.id}
                      id={`rule-${topic.id}`}
                      className={`scroll-mt-6 rounded-lg border border-amber-900/10 bg-[#fffef8]/60 p-4 sm:p-5 ${bookTheme.listItem}`}
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <h4 className="min-w-0 flex-1 text-base font-semibold text-foreground">
                          <Link
                            href={`/books/${bookId}/read/rule/${topic.id}`}
                            className="hover:text-primary"
                          >
                            {ruleHeading(topic)}
                          </Link>
                        </h4>
                        {topic.is_amended && (
                          <Badge variant="warning" className="text-[10px]">
                            Amended
                          </Badge>
                        )}
                        {isAdmin && (
                          <InlineEditTrigger
                            label="Edit rule"
                            active={editingTopic}
                            onClick={() => toggleEdit({ type: 'topic', id: topic.id })}
                          />
                        )}
                      </div>

                      {editingTopic && (
                        <TopicInlineEdit
                          topicId={topic.id}
                          currentChapterId={chapter.id}
                          chapters={chapterOptions}
                          initial={topic}
                          onCancel={() => setEditing(null)}
                          onSaved={handleSaved}
                        />
                      )}

                      {!editingTopic && (topic.description?.trim() || topic.note?.trim()) && (
                        <BookDetailsBlock html={topic.description} note={topic.note} />
                      )}

                      {!editingTopic && topic.content_link?.trim() && (
                        <RuleContentLinkEmbed
                          contentLink={topic.content_link}
                          title={ruleHeading(topic)}
                        />
                      )}

                      {topic.details.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {topic.details.map((d) => (
                            <RichTextView key={d.id} html={d.detail_text} />
                          ))}
                        </div>
                      )}

                      {topic.sub_topics.length > 0 && (
                        <ul className="mt-5 space-y-4 border-t border-amber-900/10 pt-4">
                          {topic.sub_topics.map((sub) => {
                            const editingSub = editing?.type === 'sub' && editing.id === sub.id;
                            return (
                              <li key={sub.id} id={`sub-${sub.id}`} className="scroll-mt-6">
                                <div className="flex flex-wrap items-start gap-2">
                                  <p className="min-w-0 flex-1 font-medium text-foreground">
                                    {subRuleHeading(sub)}
                                  </p>
                                  {isAdmin && (
                                    <InlineEditTrigger
                                      label="Edit sub-rule"
                                      active={editingSub}
                                      onClick={() => toggleEdit({ type: 'sub', id: sub.id })}
                                    />
                                  )}
                                </div>
                                {editingSub && (
                                  <SubTopicInlineEdit
                                    subTopicId={sub.id}
                                    initial={sub}
                                    onCancel={() => setEditing(null)}
                                    onSaved={handleSaved}
                                  />
                                )}
                                {!editingSub && (
                                  <div className="mt-2">
                                    <BookDetailsBlock html={sub.description} note={sub.note} />
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        );
      })}
    </article>
  );
}
