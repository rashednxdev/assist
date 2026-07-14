import { insertBookListMarkerLineBreaks } from '@ibas/shared-constants';
import type { ComparisonTable, ExplanationSection } from '@ibas/shared-types';
import { hasComparisonTableContent, hasExplanationContent } from '@ibas/shared-types';
import { Badge } from '@/components/ui/badge';
import { ComparisonTableView } from '@/components/questions/comparison-table-view';

interface QuestionOptionView {
  id?: string;
  option_key: string;
  option_text_en: string;
  option_text_bn?: string;
  is_correct?: boolean;
}

interface QuestionAnswerViewProps {
  body_en: string;
  body_bn?: string;
  has_options: boolean;
  options?: QuestionOptionView[];
  model_answer_sections?: ExplanationSection[];
  model_answer_comparison?: ComparisonTable | null;
  explanation_sections?: ExplanationSection[];
  answer_note?: string;
  showAnswer: boolean;
}

function formatQuestionText(text?: string) {
  if (!text?.trim()) return '';
  return insertBookListMarkerLineBreaks(text.trim(), '\n');
}

function TextBlock({
  text,
  className = '',
}: {
  text?: string;
  className?: string;
}) {
  const formatted = formatQuestionText(text);
  if (!formatted) return null;
  return (
    <p
      className={`whitespace-pre-wrap text-justify text-sm leading-relaxed text-foreground ${className}`}
    >
      {formatted}
    </p>
  );
}

function SubsectionBlock({ sub }: { sub: ExplanationSection['subsections'][number] }) {
  const hasContent = sub.subtitle?.trim() || sub.details?.trim() || sub.note?.trim();
  if (!hasContent) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-background/80 p-3">
      {sub.subtitle?.trim() && <p className="text-sm font-semibold text-foreground">{sub.subtitle}</p>}
      <TextBlock text={sub.details} />
      <TextBlock text={sub.note} />
    </div>
  );
}

function SectionBlock({ section }: { section: ExplanationSection }) {
  const hasContent =
    section.title?.trim() ||
    section.details?.trim() ||
    section.note?.trim() ||
    section.subsections?.some((sub) => sub.subtitle?.trim() || sub.details?.trim() || sub.note?.trim());

  if (!hasContent) return null;

  return (
    <div className="space-y-4">
      {section.title?.trim() && <h4 className="text-base font-semibold text-foreground">{section.title}</h4>}
      <TextBlock text={section.details} />
      <TextBlock text={section.note} />

      {section.subsections?.length > 0 && (
        <div className="space-y-3 border-l-2 border-primary/25 pl-4">
          {section.subsections.map((sub, subIndex) => (
            <SubsectionBlock key={subIndex} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}

function StructuredSectionsPanel({
  heading,
  sections,
  variant = 'muted',
}: {
  heading: string;
  sections: ExplanationSection[];
  variant?: 'muted' | 'primary';
}) {
  return (
    <section
      className={`space-y-5 rounded-xl border p-4 ${
        variant === 'primary'
          ? 'border-primary/30 bg-primary-muted/20'
          : 'border-border bg-slate-50/80'
      }`}
    >
      <div
        className={`text-xs font-semibold uppercase tracking-wide ${
          variant === 'primary' ? 'text-primary' : 'text-muted'
        }`}
      >
        {heading}
      </div>
      {sections.map((section, index) => (
        <SectionBlock key={index} section={section} />
      ))}
    </section>
  );
}

export function QuestionAnswerView({
  body_en,
  body_bn,
  has_options,
  options = [],
  model_answer_sections,
  model_answer_comparison,
  explanation_sections,
  answer_note,
  showAnswer,
}: QuestionAnswerViewProps) {
  const explanation = explanation_sections ?? [];
  const modelAnswer = model_answer_sections ?? [];
  const showStructuredExplanation = showAnswer && has_options && hasExplanationContent(explanation);
  const showComparisonModel =
    showAnswer && !has_options && hasComparisonTableContent(model_answer_comparison);
  const showStructuredModelAnswer =
    showAnswer && !has_options && !showComparisonModel && hasExplanationContent(modelAnswer);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">Question</div>
        <TextBlock text={body_en} className="text-base font-medium" />
        {body_bn?.trim() ? <TextBlock text={body_bn} className="text-muted" /> : null}
      </section>

      {has_options && options.length > 0 && (
        <section className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">Options</div>
          <div className="space-y-2">
            {options.map((opt) => {
              const isCorrect = showAnswer && opt.is_correct;
              return (
                <div
                  key={opt.id ?? opt.option_key}
                  className={`rounded-lg border p-3 ${
                    isCorrect ? 'border-primary bg-primary-muted/40' : 'border-border bg-background'
                  }`}
                >
                  <div className="flex gap-2">
                    <span className="shrink-0 font-semibold uppercase">{opt.option_key}.</span>
                    <TextBlock text={opt.option_text_en} className="min-w-0 flex-1" />
                  </div>
                  {opt.option_text_bn ? (
                    <TextBlock text={opt.option_text_bn} className="mt-1 text-muted" />
                  ) : null}
                  {isCorrect && (
                    <Badge className="mt-2" variant="default">
                      Correct answer
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {showComparisonModel && <ComparisonTableView table={model_answer_comparison} />}

      {showStructuredModelAnswer && (
        <StructuredSectionsPanel heading="Model answer" sections={modelAnswer} variant="primary" />
      )}

      {showStructuredExplanation && (
        <StructuredSectionsPanel heading="Explanation" sections={explanation} />
      )}

      {showAnswer && answer_note?.trim() && (
        <section className="rounded-lg border border-dashed border-border px-4 py-3">
          <TextBlock text={answer_note} />
        </section>
      )}
    </div>
  );
}
