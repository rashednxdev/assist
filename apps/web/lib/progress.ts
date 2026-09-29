export interface ProgressDashboardData {
  mcq: {
    submitted: number;
    correct: number;
    incorrect: number;
    accuracy_percent: number;
  };
  papers: {
    attempted: number;
    rated_questions: number;
    total_questions: number;
    average_progress_percent: number;
  };
  exam_attempts: {
    total_attempts: number;
    papers_attempted: number;
    papers_passed: number;
    items: Array<{
      paper_id: string;
      paper_name: string;
      attempts_count: number;
      best_scored_marks: number;
      best_total_marks: number;
      best_percent: number;
      is_pass: boolean;
      last_submitted_at: string;
    }>;
  };
}
