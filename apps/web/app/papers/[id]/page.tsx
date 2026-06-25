'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Pencil } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { banglaText, formatDurationBn, toBanglaDigits } from '@/lib/bangla-format';
import {
  displayQuestionLabel,
  marksPreview,
  primaryQuestionId,
  questionInlineText,
  showPartsList,
  type PaperQuestionRow,
} from '@/lib/paper-display';

interface ComposeData {
  paper: {
    id: string;
    name: string;
    session_year?: string;
    total_marks: number;
    pass_marks: number;
    duration_minutes: number;
    instructions?: string;
    is_published: boolean;
    exam_subject_name?: string;
    exam_subject_name_bn?: string;
    exam_part_name?: string;
    exam_part_name_bn?: string;
    exam_name?: string;
    exam_name_bn?: string;
    exam_short_name?: string;
    session_label_bn?: string;
    paper_type_name?: string;
  };
  groups: Array<{
    id: string;
    name: string;
    group_number: number;
    marks: number;
    instructions?: string;
    questions: PaperQuestionRow[];
  }>;
  ungrouped_questions: PaperQuestionRow[];
}

function QuestionLink({
  paperId,
  questionId,
  children,
  className,
}: {
  paperId: string;
  questionId: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={`/papers/${paperId}/questions/${questionId}`}
      className={`text-inherit underline-offset-2 hover:underline ${className ?? ''}`}
    >
      {children}
    </Link>
  );
}

function renderQuestionRow(paperId: string, pq: PaperQuestionRow) {
  const displayNo = toBanglaDigits(displayQuestionLabel(pq));
  const inline = questionInlineText(pq);
  const tapId = primaryQuestionId(pq);
  const marksLine = pq.marks_display_bn?.trim()
    ? toBanglaDigits(pq.marks_display_bn)
    : toBanglaDigits(marksPreview(pq).replace(/ marks?$/i, ''));

  return (
    <div key={pq.id} className="paper-sheet-question">
      <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <span className="shrink-0 font-semibold">{displayNo}.</span>
        {tapId ? (
          <QuestionLink paperId={paperId} questionId={tapId} className="min-w-0 flex-1">
            {inline ?? pq.question?.body_en ?? pq.parts[0]?.question?.body_en ?? ''}
          </QuestionLink>
        ) : (
          inline && <span className="min-w-0 flex-1">{inline}</span>
        )}
        <span className="ml-auto shrink-0 text-sm text-muted">[{marksLine}]</span>
      </div>
      {showPartsList(pq) && (
        <ul className="mt-2 space-y-2 pl-5">
          {pq.parts.map((part) => {
            const partMarks = part.marks_display_bn?.trim()
              ? toBanglaDigits(part.marks_display_bn)
              : toBanglaDigits(String(part.marks));
            return (
              <li key={part.id} className="flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-semibold">{toBanglaDigits(part.part_label)}</span>
                <QuestionLink paperId={paperId} questionId={part.question_id} className="min-w-0 flex-1">
                  {part.question?.body_en ?? ''}
                </QuestionLink>
                <span className="text-sm text-muted">[{partMarks}]</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function PaperHeader({ paper }: { paper: ComposeData['paper'] }) {
  const examName = paper.exam_name_bn?.trim() || paper.exam_name?.trim() || paper.exam_short_name || '';
  const partName =
    paper.exam_part_name_bn?.trim() || paper.exam_part_name?.trim() || '';
  const sessionLabel = paper.session_label_bn?.trim() || paper.session_year?.trim() || '';
  const examLine = [examName, partName, sessionLabel]
    .filter(Boolean)
    .map((segment) => banglaText(segment))
    .join('/');
  const subjectLine = paper.exam_subject_name_bn?.trim() || paper.exam_subject_name?.trim() || '';

  return (
    <header className="relative border-b border-amber-900/10 pb-6">
      <div className="absolute right-0 top-0 max-w-[45%] text-right text-sm font-semibold leading-snug text-foreground">
        {paper.name}
      </div>
      <div className="space-y-2 pt-1 text-center text-base leading-relaxed sm:text-lg">
        {examLine && <p className="font-semibold">{examLine}</p>}
        {subjectLine && <p className="font-medium">{subjectLine}</p>}
        <p>সময়- {formatDurationBn(paper.duration_minutes)}</p>
        <p>পূর্ণমান- {toBanglaDigits(paper.total_marks)}</p>
        <p>পাস নম্বর- {toBanglaDigits(paper.pass_marks)}</p>
      </div>
    </header>
  );
}

export default function PaperDetailPage() {
  const params = useParams();
  const paperId = params.id as string;
  const [data, setData] = useState<ComposeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      apiFetch<{ data: ComposeData }>(`/papers/${paperId}/compose`),
      fetchMe(),
    ])
      .then(([composeRes, meRes]) => {
        setData(composeRes.data);
        setIsAdmin(
          meRes.data.is_super_admin ||
            meRes.data.user_type === 'system_admin' ||
            meRes.data.user_type === 'admin',
        );
      })
      .catch(() => setError('Paper not found or not available.'))
      .finally(() => setLoading(false));
  }, [paperId]);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;600;700&display=swap';
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[480px] w-full max-w-3xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Alert variant="error">{error || 'Paper not found.'}</Alert>
        <Button asChild variant="outline">
          <Link href="/papers">
            <ArrowLeft className="h-4 w-4" />
            Back to papers
          </Link>
        </Button>
      </div>
    );
  }

  const { paper, groups, ungrouped_questions } = data;
  const allQuestions = [
    ...groups.flatMap((g) => g.questions),
    ...ungrouped_questions,
  ];

  return (
    <div className="space-y-4 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/papers">
            <ArrowLeft className="h-4 w-4" />
            Papers
          </Link>
        </Button>
        {isAdmin && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/papers/${paperId}/edit`}>
              <Pencil className="h-4 w-4" />
              Compose
            </Link>
          </Button>
        )}
      </div>

      <article className="paper-sheet mx-auto max-w-3xl rounded-sm border border-amber-900/15 px-6 py-8 shadow-md sm:px-10 sm:py-10">
        <PaperHeader paper={paper} />

        {paper.instructions && (
          <section className="border-b border-amber-900/10 py-5 text-center text-sm leading-relaxed whitespace-pre-wrap sm:text-base">
            {toBanglaDigits(paper.instructions)}
          </section>
        )}

        <div className="pt-4">
          {groups.map((group) => (
            <section key={group.id} className="mb-6 last:mb-0">
              {(group.name || group.instructions) && (
                <div className="mb-3 text-center text-sm font-semibold sm:text-base">
                  {group.name && <p>{group.name}</p>}
                  {group.instructions && (
                    <p className="mt-1 font-normal text-muted">{group.instructions}</p>
                  )}
                </div>
              )}
              {group.questions.map((pq) => renderQuestionRow(paperId, pq))}
            </section>
          ))}

          {ungrouped_questions.length > 0 && (
            <section>
              {groups.length > 0 && (
                <p className="mb-3 text-center text-sm font-semibold">প্রশ্ন</p>
              )}
              {ungrouped_questions.map((pq) => renderQuestionRow(paperId, pq))}
            </section>
          )}

          {allQuestions.length === 0 && (
            <p className="py-8 text-center text-muted">এই পত্রে এখনও কোনো প্রশ্ন নেই।</p>
          )}
        </div>
      </article>

      <p className="mx-auto max-w-3xl text-center text-xs text-muted">
        প্রশ্নে ট্যাপ করলে উত্তর ও ব্যাখ্যা দেখতে পারবেন।
      </p>
    </div>
  );
}
