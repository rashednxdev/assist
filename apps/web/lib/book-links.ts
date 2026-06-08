/** Build a reader URL for syllabus or question links into book content. */
export function bookContentHref(ref: {
  ref_level?: string;
  book_info_id?: string;
  book_chapter_id?: string;
  book_topic_id?: string;
  regulation_id?: string;
}): string | null {
  if (ref.ref_level === 'regulation' && ref.regulation_id) {
    return `/books/regulations/${ref.regulation_id}`;
  }

  const bookId = ref.book_info_id;
  if (!bookId) return null;

  const params = new URLSearchParams();
  if (ref.book_topic_id) params.set('topic', ref.book_topic_id);
  else if (ref.book_chapter_id) params.set('chapter', ref.book_chapter_id);

  const qs = params.toString();
  return `/books/${bookId}${qs ? `?${qs}` : ''}`;
}
