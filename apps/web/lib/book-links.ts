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

/** Reader URLs for question tags (chapter / rule read screens). */
export function taggedQuestionLocationHref(ref: {
  book_info_id?: string;
  book_id?: string;
  book_chapter_id?: string;
  book_topic_id?: string;
  book_sub_topic_id?: string;
  regulation_id?: string;
}): string | null {
  const bookId = ref.book_info_id?.trim() || ref.book_id?.trim();
  if (ref.regulation_id && !bookId && !ref.book_chapter_id && !ref.book_topic_id) {
    return `/books/regulations/${ref.regulation_id}`;
  }
  if (!bookId) return null;
  if (ref.book_topic_id) {
    const base = `/books/${bookId}/read/rule/${ref.book_topic_id}`;
    if (ref.book_sub_topic_id) return `${base}#sub-${ref.book_sub_topic_id}`;
    return base;
  }
  if (ref.book_chapter_id) {
    return `/books/${bookId}/read/chapter/${ref.book_chapter_id}`;
  }
  return bookContentHref({ book_info_id: bookId, ...ref });
}
