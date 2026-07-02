export interface ExamProgramItem {
  id: string;
  name: string;
  short_name: string;
  authority_name?: string;
  registration_fee: number;
  goal?: string;
}

export interface ExamSession {
  id: string;
  label_en: string;
  label_bn?: string;
  sort_order: number;
}

export interface ExamType {
  id: string;
  name: string;
  code?: string;
  total_time: number;
}

export interface ExamSubject {
  id: string;
  name: string;
  total_marks: number;
  pass_marks: number;
  exam_type_name?: string;
}

export interface ExamPart {
  id: string;
  name: string;
  part_number: number;
  total_marks: number;
  pass_marks: number;
  subjects: ExamSubject[];
}

export interface ExamTree {
  exam: {
    id: string;
    name: string;
    short_name: string;
    registration_fee: number;
    authority_name?: string;
  };
  sessions: ExamSession[];
  parts: ExamPart[];
  types: ExamType[];
}

export interface SyllabusReference {
  id: string;
  ref_level?: string;
  book_info_id?: string;
  book_chapter_id?: string;
  book_topic_id?: string;
  regulation_id?: string;
  relevance_note?: string;
  book_name?: string;
  book_short_name?: string;
  chapter_name?: string;
  chapter_number?: string;
  topic_name?: string;
  rule_number?: string;
  regulation_no?: string;
  regulation_title?: string;
}

export interface SyllabusSubTopic {
  id: string;
  name: string;
  description?: string;
}

export interface SyllabusTopic {
  id: string;
  name: string;
  description?: string;
  marks_weightage?: number;
  sub_topics: SyllabusSubTopic[];
  references: SyllabusReference[];
}

export interface SyllabusGroup {
  id: string;
  name: string;
  marks_allocated: number;
  topics: SyllabusTopic[];
}

export interface SubjectSyllabusTree {
  exam_subject_id: string;
  groups: SyllabusGroup[];
  subject_topics: SyllabusTopic[];
}
