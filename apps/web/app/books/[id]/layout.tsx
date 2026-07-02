'use client';

import { BookReaderProvider } from '@/components/books/book-reader-context';

export default function BookIdLayout({ children }: { children: React.ReactNode }) {
  return <BookReaderProvider>{children}</BookReaderProvider>;
}
