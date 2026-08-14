import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchQuestionTypes, fetchQuestionSubjectCatalog, type SubjectCatalogItem } from '@/lib/questions-api';
import { fetchQuestionBookCatalog, type BookCatalogItem } from '@/lib/question-edit-api';
import type { QuestionType } from '@/types/questions';

interface QuestionUpdateCatalogsValue {
  types: QuestionType[];
  subjectCatalog: SubjectCatalogItem[];
  bookCatalog: BookCatalogItem[];
  catalogsReady: boolean;
}

const QuestionUpdateCatalogsContext = createContext<QuestionUpdateCatalogsValue | null>(null);

/**
 * Loads subject/book catalogs (and question types) once when Question Update is opened,
 * and keeps them until the user leaves the module.
 */
export function QuestionUpdateCatalogsProvider({ children }: { children: ReactNode }) {
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [subjectCatalog, setSubjectCatalog] = useState<SubjectCatalogItem[]>([]);
  const [bookCatalog, setBookCatalog] = useState<BookCatalogItem[]>([]);
  const [catalogsReady, setCatalogsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      fetchQuestionTypes(),
      fetchQuestionSubjectCatalog(),
      fetchQuestionBookCatalog(),
    ]).then(([typesRes, subjectsRes, booksRes]) => {
      if (cancelled) return;
      setTypes(typesRes.status === 'fulfilled' ? typesRes.value : []);
      setSubjectCatalog(subjectsRes.status === 'fulfilled' ? subjectsRes.value : []);
      setBookCatalog(booksRes.status === 'fulfilled' ? booksRes.value : []);
      setCatalogsReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({ types, subjectCatalog, bookCatalog, catalogsReady }),
    [types, subjectCatalog, bookCatalog, catalogsReady],
  );

  return (
    <QuestionUpdateCatalogsContext.Provider value={value}>
      {children}
    </QuestionUpdateCatalogsContext.Provider>
  );
}

export function useQuestionUpdateCatalogs() {
  const ctx = useContext(QuestionUpdateCatalogsContext);
  if (!ctx) {
    throw new Error('useQuestionUpdateCatalogs must be used within QuestionUpdateCatalogsProvider');
  }
  return ctx;
}
