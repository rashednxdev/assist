'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import {
  QuestionEditor,
  emptyQuestionForm,
  questionFormToPayload,
  resetQuestionFormKeepingType,
  validateQuestionForm,
  type QuestionFormValues,
} from '@/components/questions/question-editor';
import { Alert } from '@/components/ui/alert';

interface QuestionType {
  id: string;
  code: string;
  name: string;
  has_options: boolean;
}

export default function NewQuestionPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [types, setTypes] = useState<QuestionType[]>([]);
  const [form, setForm] = useState<QuestionFormValues>(emptyQuestionForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchMe()
      .then((res) => {
        const admin =
          res.data.is_super_admin || res.data.user_type === 'system_admin' || res.data.user_type === 'admin';
        setAllowed(admin);
        if (!admin) {
          router.replace('/questions');
          return;
        }
        return apiFetch<{ data: QuestionType[] }>('/questions/types').then((r) => {
          setTypes(r.data);
          const mcq = r.data.find((t) => t.code === 'MCQ') ?? r.data[0];
          if (mcq) {
            setForm((f) => ({
              ...f,
              question_type_id: mcq.id,
              question_type_code: mcq.code,
              has_options: mcq.has_options,
            }));
          }
        });
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setBusy(true);
    try {
      const validationError = validateQuestionForm(form);
      if (validationError) {
        setError(validationError);
        return;
      }
      const payload = questionFormToPayload(form);
      await apiFetch<{ data: { id: string } }>('/questions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setForm((current) => resetQuestionFormKeepingType(current));
      setSuccess('Question saved. You can add another question of the same type.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create question');
    } finally {
      setBusy(false);
    }
  }

  if (allowed === null) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New question"
        description="Create MCQ, true/false, descriptive, or short-note questions linked to chapters, rules, or sub-rules."
        action={
          <Button asChild variant="outline" size="sm">
            <Link href="/questions">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        }
      />
      {success && <Alert variant="success">{success}</Alert>}
      <QuestionEditor
        value={form}
        onChange={setForm}
        onSubmit={handleSubmit}
        questionTypes={types}
        busy={busy}
        error={error}
      />
    </div>
  );
}
