export interface PaperType {
  id: string;
  name: string;
  code: string;
  description?: string;
}

export interface PaperItem {
  id: string;
  name: string;
  session_year?: string;
  exam_session_id?: string;
  exam_subject_id: string;
  paper_type_id: string;
  total_marks: number;
  pass_marks: number;
  duration_minutes: number;
  instructions?: string;
  is_published: boolean;
  exam_subject_name?: string;
  exam_short_name?: string;
  exam_name?: string;
  session_label_en?: string;
  session_label_bn?: string;
  paper_type_name?: string;
  paper_type_code?: string;
  question_count: number;
}

export interface PaperQuestionBrief {
  id: string;
  question_type_code?: string;
  question_type_name?: string;
  body_en: string;
  difficulty?: string;
  marks: number;
  is_published?: boolean;
}

export interface PaperQuestionPart {
  id: string;
  question_id: string;
  part_label: string;
  marks: number;
  marks_display_bn?: string;
  question?: PaperQuestionBrief;
}

export interface PaperQuestionRow {
  id: string;
  from_question_bank: boolean;
  question_id?: string;
  header_text?: string;
  question_number: number;
  display_question_number?: string;
  marks: number;
  marks_display_bn?: string;
  is_compulsory: boolean;
  question?: PaperQuestionBrief;
  parts: PaperQuestionPart[];
}

export interface PaperGroup {
  id: string;
  name: string;
  group_number: number;
  marks: number;
  instructions?: string;
  questions: PaperQuestionRow[];
}

export interface PaperComposeData {
  paper: PaperItem;
  groups: PaperGroup[];
  ungrouped_questions: PaperQuestionRow[];
}
