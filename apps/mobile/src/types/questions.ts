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
  /** Who most recently set the current review_status — undefined for legacy questions. Question Update module only. */
  status_by_name?: string;
  book_chapter_id?: string;
  book_topic_id?: string;
  book_sub_topic_id?: string;
  regulation_id?: string;
  book_id?: string;
  book_name?: string;
  chapter_number?: string;
  chapter_name?: string;
  book_link_count?: number;
  /** Exam subjects tagged on this question (from sync cache or live list). */
  subjects?: Array<{ id: string; name: string; name_bn?: string }>;
  option_count: number;
  created_at: string;
  updated_at: string;
  /** Papers that include this question (live /questions list only). */
  used_in_papers?: Array<{
    id: string;
    name: string;
    session_year?: string;
    session_label_en?: string;
    session_label_bn?: string;
    question_number?: number;
    via: 'direct' | 'child_part';
  }>;
}

export interface QuestionOption {
  id: string;
  option_key: string;
  option_text_en: string;
  option_text_bn?: string;
  is_correct: boolean;
}

export interface ProcessStep {
  title: string;
  description?: string;
  /** Free-text responsible party for this step. */
  role?: string;
}

export interface ExplanationProcess {
  title?: string;
  details?: string;
  steps: ProcessStep[];
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
  /** Optional comparison table nested under this section's title. */
  table?: ComparisonTable;
  /** Optional step-by-step process nested under this section's title. */
  process?: ExplanationProcess;
}

export interface ComparisonTable {
  /** Optional title spanning the full table width, shown centered above the column headers. */
  title?: string;
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
  /** Who most recently set the current review_status — undefined for legacy questions. Question Update module only. */
  status_by_name?: string;
  book_id?: string;
  book_name?: string;
  chapter_number?: string;
  chapter_name?: string;
  options: QuestionOption[];
  correct_option_key?: string;
  correct_true_false?: 'true' | 'false';
  explanation_sections?: ExplanationSection[];
  model_answer_sections?: ExplanationSection[];
  /** Set when this question is a "prototype" sharing its model answer from a "mother" question. */
  mother_question_id?: string;
  mother_question_label?: string;
  /** Other prototype questions in the same family (siblings if viewing a prototype, followers if viewing the mother). */
  prototype_questions?: Array<{ id: string; label: string }>;
  model_answer_comparison?: ComparisonTable;
  note?: string;
  book_links?: QuestionBookLink[];
  /** Papers that include this question (from live /questions/:id — not in offline sync cache). */
  used_in_papers?: Array<{
    id: string;
    name: string;
    session_year?: string;
    session_label_en?: string;
    session_label_bn?: string;
    question_number?: number;
    via: 'direct' | 'child_part';
  }>;
}
