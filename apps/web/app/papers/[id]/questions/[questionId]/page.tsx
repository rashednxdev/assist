'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { serializeExplanationSections, type ComparisonTable, type ExplanationSection } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { QuestionAnswerView } from '@/components/questions/question-answer-view';
import { QuestionEvaluator } from '@/components/evaluation/question-evaluator';

interface QuestionDetail {
  id: string;
  body_en: string;
  body_bn?: string;
  marks: number;
  question_type_code: string;
  question_type_name?: string;
  has_options: boolean;
  model_answer_sections?: ExplanationSection[];
  model_answer_comparison?: ComparisonTable;
  explanation_sections?: ExplanationSection[];
  note?: string;
  options: {
    id: string;
    option_key: string;
    option_text_en: string;
    option_text_bn?: string;
    is_correct: boolean;
  }[];
}

interface PaperBrief {
  id: string;
  name: string;
  is_published: boolean;
}

export default function PaperQuestionAnswerPage() {
  const params = useParams();
  const paperId = params.id as string;
  const questionId = params.questionId as string;
  const [paper, setPaper] = useState<PaperBrief | null>(null);
  const [question, setQuestion] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: PaperBrief }>(`/papers/${paperId}`),
      apiFetch<{ data: QuestionDetail }>(`/questions/${questionId}`),
    ])
      .then(([paperRes, questionRes]) => {
        setPaper(paperRes.data);
        setQuestion(questionRes.data);
      })
      .catch(() => setError('Could not load this question.'))
      .finally(() => setLoading(false));
  }, [paperId, questionId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (error || !paper || !question) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{error || 'Question not found.'}</Alert>
        <Button asChild variant="outline">
          <Link href={`/papers/${paperId}`}>
            <ArrowLeft className="h-4 w-4" />
            Back to paper
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Answer"
        description={paper.name}
        action={
          <Button asChild variant="outline" size="sm">
            <Link href={`/papers/${paperId}`}>
              <ArrowLeft className="h-4 w-4" />
              Back to paper
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline">{question.question_type_code}</Badge>
        <Badge variant="secondary">{question.marks} marks</Badge>
      </div>

      <QuestionEvaluator questionId={questionId} />

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {question.question_type_name ?? question.question_type_code}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <QuestionAnswerView
            body_en={question.body_en}
            body_bn={question.body_bn}
            has_options={question.has_options}
            options={question.options}
            model_answer_sections={serializeExplanationSections(question.model_answer_sections)}
            model_answer_comparison={question.model_answer_comparison}
            explanation_sections={serializeExplanationSections(question.explanation_sections)}
            answer_note={question.note}
            showAnswer
          />
        </CardContent>
      </Card>
    </div>
  );
}
