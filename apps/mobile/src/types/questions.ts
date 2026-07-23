/** Draft -> quality_check -> published, with published/quality_check able to fall back a stage. */
export type ReviewStatus = 'draft' | 'quality_check' | 'published';

export interface QuestionType {
  id: string;
  code: string;
  name: string;
  has_options: boolean;
}

export interface QuestionListItem {
  id: string;
  question_type_id: string;
  question_type_code: string;
  question_type_name?: string;
  body_en: string;
  body_bn?: string;
  difficulty: string;
  marks: number;
  time_seconds: number;
  is_published: boolean;
  /** Not populated by the offline sync cache (Question Bank/Marathon) — only by live /questions calls. */
  review_status?: ReviewStatus;
  book_chapter_id?: string;
  book_topic_id?: string;
  book_sub_topic_id?: string;
  regulation_id?: string;
  book_id?: string;
  book_name?: string;
  chapter_number?: string;
  chapter_name?: string;
  book_link_count?: number;
  option_count: number;
  created_at: string;
  updated_at: string;
}

export interface QuestionOption {
  id: string;
  option_key: string;
  option_text_en: string;
  option_text_bn?: string;
  is_correct: boolean;
}

export interface ExplanationSection {
  title?: string;
  content?: string;
  details?: string;
  note?: string;
  subsections?: {
    subtitle?: string;
    details?: string;
    note?: string;
  }[];
}

export interface ComparisonTable {
  feature_header?: string;
  columns: string[];
  rows: Array<{ feature: string; values: string[] }>;
}

export interface QuestionBookLink {
  id?: string;
  link_level: 'chapter' | 'rule' | 'sub_rule';
  book_id?: string;
  book_name?: string;
  book_chapter_id?: string;
  chapter_number?: string;
  chapter_name?: string;
  book_topic_id?: string;
  book_sub_topic_id?: string;
  regulation_id?: string;
  label?: string;
}

export interface QuestionDetail {
  id: string;
  question_type_id: string;
  question_type_code: string;
  question_type_name?: string;
  has_options: boolean;
  body_en: string;
  body_bn?: string;
  difficulty: string;
  marks: number;
  negative_marks?: number;
  time_seconds: number;
  is_published: boolean;
  /** Not populated by the offline sync cache (Question Bank/Marathon) — only by live /questions calls. */
  review_status?: ReviewStatus;
  book_id?: string;
  book_name?: string;
  chapter_number?: string;
  chapter_name?: string;
  options: QuestionOption[];
  correct_option_key?: string;
  correct_true_false?: 'true' | 'false';
  explanation_sections?: ExplanationSection[];
  model_answer_sections?: ExplanationSection[];
  model_answer_comparison?: ComparisonTable;
  note?: string;
  book_links?: QuestionBookLink[];
}
