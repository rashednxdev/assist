'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil } from 'lucide-react';
import { ProgressLinkButton } from '@/components/evaluation/progress-link-button';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RichTextView } from '@/components/books/rich-text-view';
import { BookTree } from '@/components/books/book-tree';
import { BookContentEditor } from '@/components/books/book-content-editor';

interface BookDetail {
  id: string;
  name: string;
  name_bn: string;
  short_name: string;
  description: string;
  edition?: string;
  published_by?: string;
  effective_date?: string;
  language: string;
  tags: string[];
}

interface TreeNode {
  type: 'part' | 'chapter' | 'topic' | 'sub_topic';
  id: string;
  name: string;
  has_children?: boolean;
  children?: TreeNode[];
}

export default function BookDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const bookId = params.id as string;
  const focusChapterId = searchParams.get('chapter');
  const focusTopicId = searchParams.get('topic');
  const [book, setBook] = useState<BookDetail | null>(null);
  const [nodes, setNodes] = useState<TreeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [treeKey, setTreeKey] = useState(0);

  const reload = useCallback(() => {
    if (!bookId) return Promise.resolve();
    return Promise.all([
      apiFetch<{ data: BookDetail }>(`/books/${bookId}`),
      apiFetch<{ data: { book: BookDetail; nodes: TreeNode[] } }>(`/books/${bookId}/tree?depth=1`),
    ]).then(([bookRes, treeRes]) => {
      setBook(bookRes.data);
      setNodes(treeRes.data.nodes);
      setTreeKey((k) => k + 1);
    });
  }, [bookId]);

  useEffect(() => {
    if (!bookId) return;
    reload().finally(() => setLoading(false));
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
  }, [bookId, reload]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!book) {
    return <p className="text-muted">Book not found.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/books">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <ProgressLinkButton
          href={`/books/${bookId}/progress`}
          evaluationPath={`/evaluation/books/${bookId}`}
        />
        {isAdmin && (
          <Button
            size="sm"
            variant={editMode ? 'default' : 'outline'}
            onClick={() => setEditMode(!editMode)}
          >
            <Pencil className="h-4 w-4" />
            {editMode ? 'View mode' : 'Edit content'}
          </Button>
        )}
      </div>

      <PageHeader title={book.name} description={book.name_bn} />

      <div className="flex flex-wrap gap-2">
        {book.short_name && <Badge variant="outline">{book.short_name}</Badge>}
        {book.edition && <Badge variant="secondary">Edition {book.edition}</Badge>}
        <Badge variant="outline">{book.language}</Badge>
        {book.published_by && <Badge variant="outline">{book.published_by}</Badge>}
      </div>

      {!editMode && <RichTextView html={book.description} className="text-muted" />}

      {isAdmin && editMode ? (
        <BookContentEditor bookId={bookId} book={book} onRefresh={() => reload()} />
      ) : (
        <BookTree
          key={`${treeKey}:${focusChapterId ?? ''}:${focusTopicId ?? ''}`}
          bookId={bookId}
          initialNodes={nodes}
          focusChapterId={focusChapterId}
          focusTopicId={focusTopicId}
        />
      )}
    </div>
  );
}
