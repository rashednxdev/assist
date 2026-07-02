export interface BookListItem {
  id: string;
  book_type_id: string;
  book_type_name?: string;
  name: string;
  name_bn: string;
  short_name?: string;
  description?: string;
  edition?: string;
  publish_date?: string;
  published_by?: string;
  effective_date?: string;
  language: string;
  tags: string[];
}

export interface ReaderChapterTopic {
  id: string;
  rule_number: string;
  name?: string;
  sub_name?: string;
  is_amended: boolean;
  sort_order: number;
}

export interface ReaderChapter {
  id: string;
  chapter_number: string;
  name: string;
  sub_name?: string;
  description?: string;
  sort_order: number;
  topics: ReaderChapterTopic[];
}

export interface ReaderRuleNav {
  id: string;
  rule_number: string;
  name?: string;
  sub_name?: string;
  is_amended: boolean;
  chapter_id: string;
  chapter_number: string;
  chapter_name: string;
}

export interface BookReaderOutline {
  book: BookListItem;
  chapters: ReaderChapter[];
  rules: ReaderRuleNav[];
}

export interface TopicDetail {
  id: string;
  name?: string;
  sub_name?: string;
  rule_number: string;
  description?: string;
  note?: string;
  is_amended: boolean;
  chapter?: { id: string; name: string; chapter_number?: string } | null;
  details: Array<{ id: string; detail_text: string }>;
  sub_topics: Array<{
    id: string;
    name?: string;
    rule_number?: string;
    description?: string;
    note?: string;
  }>;
  regulations: Array<{ id: string; regulation_no: string; title: string }>;
}

export interface RegulationSearchRow {
  id: string;
  regulation_no: string;
  title: string;
  regulation_type: string;
  is_amended: boolean;
  payment_related: boolean;
  effective_date: string;
}

export interface RegulationAmendment {
  id: string;
  amendment_no: string;
  amendment_date: string;
  issued_by: string;
  circular_ref?: string;
  old_text?: string;
  new_text: string;
  change_summary: string;
}

export interface RegulationDetail {
  id: string;
  regulation_no: string;
  title: string;
  full_text: string;
  regulation_type: string;
  effective_date: string;
  is_amended: boolean;
  applicable_to: string[];
  payment_related: boolean;
  receipt_related: boolean;
  book_name?: string;
  book_short_name?: string;
  amendments: RegulationAmendment[];
}

export interface ChapterQuestionBrief {
  id: string;
  question_type_code: string;
  question_type_name?: string;
  body_en: string;
  body_bn: string;
  marks: number;
  difficulty: string;
}
