'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Pencil, Send, Upload } from 'lucide-react';
import { ProgressLinkButton } from '@/components/evaluation/progress-link-button';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { RichTextView } from '@/components/books/rich-text-view';
import { BookContents } from '@/components/books/book-contents';
import { BookReaderGate, useBookReader } from '@/components/books/book-reader-context';
import { BookContentEditor } from '@/components/books/book-content-editor';
import { bookTheme } from '@/lib/book-theme';

function BookDetailBody({
  isAdmin,
  editMode,
  onToggleEdit,
}: {
  isAdmin: boolean;
  editMode: boolean;
  onToggleEdit: () => void;
}) {
  const { bookId, outline, reload } = useBookReader();
  const book = outline?.book;
  const [publishBusy, setPublishBusy] = useState(false);
  const [publishError, setPublishError] = useState('');

  if (!book) return null;

  async function togglePublish() {
    if (!book) return;
    setPublishBusy(true);
    setPublishError('');
    try {
      const path = book.is_published ? `/books/${bookId}/unpublish` : `/books/${bookId}/publish`;
      await apiFetch(path, { method: 'POST' });
      await reload({ silent: true });
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Failed to update book status');
    } finally {
      setPublishBusy(false);
    }
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
          <Button size="sm" variant={editMode ? 'default' : 'outline'} onClick={onToggleEdit}>
            <Pencil className="h-4 w-4" />
            {editMode ? 'View mode' : 'Edit content'}
          </Button>
        )}
        {isAdmin && (
          <Button size="sm" variant="outline" disabled={publishBusy} onClick={() => void togglePublish()}>
            {book.is_published ? <Send className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            {book.is_published ? 'Unpublish' : 'Publish'}
          </Button>
        )}
      </div>

      {publishError && <Alert variant="error">{publishError}</Alert>}

      <PageHeader title={book.name} description={book.name_bn} />

      <div className="flex flex-wrap gap-2">
        {book.short_name && <Badge variant="outline">{book.short_name}</Badge>}
        {book.edition && <Badge variant="secondary">Edition {book.edition}</Badge>}
        <Badge variant="outline">{book.language}</Badge>
        {book.published_by && <Badge variant="outline">{book.published_by}</Badge>}
        {book.book_type_name && <Badge variant="secondary">{book.book_type_name}</Badge>}
        {isAdmin && (
          <Badge variant={book.is_published ? 'success' : 'outline'}>
            {book.is_published ? 'Published' : 'Draft'}
          </Badge>
        )}
      </div>

      {!editMode && book.description?.trim() && (
        <div className={`${bookTheme.panel} p-5`}>
          <RichTextView html={book.description} className="text-muted" />
        </div>
      )}

      {isAdmin && editMode ? (
        <BookContentEditor
          bookId={bookId}
          book={{
            id: book.id,
            name: book.name,
            name_bn: book.name_bn,
            short_name: book.short_name,
            description: book.description,
            edition: book.edition,
            published_by: book.published_by,
            language: book.language,
            tags: book.tags,
          }}
          onRefresh={() => reload({ silent: true })}
        />
      ) : (
        <BookContents isAdmin={isAdmin} />
      )}
    </div>
  );
}

export default function BookDetailPage() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchMe()
      .then((res) => {
        setIsAdmin(
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin',
        );
      })
      .catch(() => {});
  }, []);

  return (
    <BookReaderGate>
      <BookDetailBody
        isAdmin={isAdmin}
        editMode={editMode}
        onToggleEdit={() => setEditMode((v) => !v)}
      />
    </BookReaderGate>
  );
}
