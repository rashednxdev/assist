import { serializeExplanationSections, type ExplanationSection } from '@ibas/shared-types';
import {
  emptyQuestionForm,
  type QuestionBookLinkForm,
  type QuestionFormValues,
} from '@/components/questions/question-editor';

export interface QuestionDetailForForm {
  question_type_id: string;
  question_type_code: string;
  has_options: boolean;
  body_en: string;
  body_bn?: string;
  difficulty: string;
  marks: number;
  negative_marks?: number;
  time_seconds: number;
  correct_option_key?: string;
  correct_true_false?: 'true' | 'false';
  model_answer_sections?: ExplanationSection[];
  explanation_sections?: ExplanationSection[];
  note?: string;
  book_links?: QuestionBookLinkForm[];
  options: {
    option_key: string;
    option_text_en: string;
    option_text_bn?: string;
  }[];
}

export function questionDetailToForm(q: QuestionDetailForForm): QuestionFormValues {
  const keys = ['a', 'b', 'c', 'd', 'e'] as const;
  const options = keys.slice(0, Math.max(4, q.options.length)).map((key) => {
    const found = q.options.find((o) => o.option_key === key);
    return {
      option_key: key,
      option_text_en: found?.option_text_en ?? '',
      option_text_bn: found?.option_text_bn,
    };
  });
  return {
    ...emptyQuestionForm,
    question_type_id: q.question_type_id,
    question_type_code: q.question_type_code,
    has_options: q.has_options,
    body_en: q.body_en,
    body_bn: q.body_bn ?? '',
    difficulty: q.difficulty as QuestionFormValues['difficulty'],
    marks: q.marks,
    negative_marks: q.negative_marks ?? 0,
    time_seconds: q.time_seconds,
    options,
    correct_option_key: (q.correct_option_key ?? 'a') as QuestionFormValues['correct_option_key'],
    correct_true_false: q.correct_true_false ?? 'true',
    model_answer_sections: serializeExplanationSections(q.model_answer_sections),
    explanation_sections: serializeExplanationSections(q.explanation_sections),
    note: q.note ?? '',
    book_links: (q.book_links ?? []).map((link) => ({
      ...link,
      book_id: link.book_id || '',
    })),
  };
}
