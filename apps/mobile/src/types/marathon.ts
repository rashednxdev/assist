export interface MarathonExplanationSection {
  title?: string;
  details?: string;
  note?: string;
  subsections?: Array<{
    subtitle?: string;
    details?: string;
    note?: string;
  }>;
}

export interface MarathonReviewItem {
  id: string;
  number: number;
  body_en: string;
  body_bn?: string;
  book_id: string;
  book_name: string;
  chapter_id: string;
  chapter_number: string;
  chapter_name: string;
  explanation_sections?: MarathonExplanationSection[];
}
