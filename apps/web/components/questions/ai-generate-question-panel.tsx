'use client';

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { GeneratedQuestionDraft } from '@ibas/shared-types';
import { QUESTION_DIFFICULTIES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Alert } from '@/components/ui/alert';

interface AiGenerateQuestionPanelProps {
  questionTypeId: string;
  bookChapterId: string;
  bookTopicId?: string;
  bookSubTopicId?: string;
  disabled?: boolean;
  onGenerated: (draft: GeneratedQuestionDraft) => void;
}

export function AiGenerateQuestionPanel({
  questionTypeId,
  bookChapterId,
  bookTopicId,
  bookSubTopicId,
  disabled,
  onGenerated,
}: AiGenerateQuestionPanelProps) {
  const [open, setOpen] = useState(false);
  const [difficulty, setDifficulty] = useState<(typeof QUESTION_DIFFICULTIES)[number]>('medium');
  const [instructions, setInstructions] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function generate() {
    if (!questionTypeId || !bookChapterId) return;
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ data: GeneratedQuestionDraft }>('/questions/ai-generate', {
        method: 'POST',
        body: JSON.stringify({
          question_type_id: questionTypeId,
          book_chapter_id: bookChapterId,
          book_topic_id: bookTopicId || undefined,
          book_sub_topic_id: bookSubTopicId || undefined,
          difficulty,
          instructions: instructions.trim() || undefined,
        }),
      });
      onGenerated(res.data);
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate question with Claude');
    } finally {
      setBusy(false);
    }
  }

  if (!bookChapterId) return null;

  return (
    <div className="rounded-lg border border-dashed border-primary/30 bg-primary-muted/20 p-3">
      {!open ? (
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => setOpen(true)}>
          <Sparkles className="h-4 w-4" />
          Generate with Claude
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Generate question from this chapter&apos;s content
          </div>
          {error && <Alert variant="error">{error}</Alert>}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai_difficulty">Difficulty</Label>
              <select
                id="ai_difficulty"
                className="ibas-select"
                value={difficulty}
                disabled={busy}
                onChange={(e) => setDifficulty(e.target.value as (typeof QUESTION_DIFFICULTIES)[number])}
              >
                {QUESTION_DIFFICULTIES.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ai_instructions">Extra instructions (optional)</Label>
            <textarea
              id="ai_instructions"
              rows={2}
              placeholder="e.g. focus on penalties for late filing"
              value={instructions}
              disabled={busy}
              onChange={(e) => setInstructions(e.target.value)}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void generate()}>
              {busy ? 'Generating…' : 'Generate'}
            </Button>
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          <p className="text-xs text-muted">
            Claude drafts the question, options/answer, and explanation from this chapter&apos;s content. Review and
            edit everything below before saving.
          </p>
        </div>
      )}
    </div>
  );
}
