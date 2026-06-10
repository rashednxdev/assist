import type { ExplanationSection } from '@ibas/shared-types';
import { hasExplanationContent } from '@ibas/shared-types';
import { Badge } from '@/components/ui/badge';

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
  explanation_sections?: ExplanationSection[];
  answer_note?: string;
  showAnswer: boolean;
}

function FieldBlock({ label, text }: { label: string; text?: string }) {
  if (!text?.trim()) return null;
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{text}</p>
    </div>
  );
}

function SubsectionBlock({ sub, index }: { sub: ExplanationSection['subsections'][number]; index: number }) {
  const hasContent = sub.subtitle?.trim() || sub.details?.trim() || sub.note?.trim();
  if (!hasContent) return null;

  return (
    <div className="space-y-3 rounded-lg border border-border/70 bg-background/80 p-3">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
          Sub-title {index + 1}
        </Badge>
        {sub.subtitle?.trim() && <span className="text-sm font-semibold text-foreground">{sub.subtitle}</span>}
      </div>
      <FieldBlock label="Details" text={sub.details} />
      <FieldBlock label="Note" text={sub.note} />
    </div>
  );
}

function SectionBlock({ section, index }: { section: ExplanationSection; index: number }) {
  const hasContent =
    section.title?.trim() ||
    section.details?.trim() ||
    section.note?.trim() ||
    section.subsections?.some((sub) => sub.subtitle?.trim() || sub.details?.trim() || sub.note?.trim());

  if (!hasContent) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
          Title {index + 1}
        </Badge>
        {section.title?.trim() && <h4 className="text-base font-semibold text-foreground">{section.title}</h4>}
      </div>
      <FieldBlock label="Details" text={section.details} />
      <FieldBlock label="Note" text={section.note} />

      {section.subsections?.length > 0 && (
        <div className="space-y-3 border-l-2 border-primary/25 pl-4">
          {section.subsections.map((sub, subIndex) => (
            <SubsectionBlock key={subIndex} sub={sub} index={subIndex} />
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
        <SectionBlock key={index} section={section} index={index} />
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
  explanation_sections,
  answer_note,
  showAnswer,
}: QuestionAnswerViewProps) {
  const explanation = explanation_sections ?? [];
  const modelAnswer = model_answer_sections ?? [];
  const showStructuredExplanation = showAnswer && has_options && hasExplanationContent(explanation);
  const showStructuredModelAnswer = showAnswer && !has_options && hasExplanationContent(modelAnswer);

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-primary">Question</div>
        <p className="text-base font-medium leading-relaxed text-foreground">{body_en}</p>
        {body_bn?.trim() && <p className="text-sm leading-relaxed text-muted">{body_bn}</p>}
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
                  <span className="mr-2 font-semibold uppercase">{opt.option_key}.</span>
                  <span className="text-sm">{opt.option_text_en}</span>
                  {opt.option_text_bn && <div className="mt-1 text-sm text-muted">{opt.option_text_bn}</div>}
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

      {showStructuredModelAnswer && (
        <StructuredSectionsPanel heading="Model answer" sections={modelAnswer} variant="primary" />
      )}

      {showStructuredExplanation && (
        <StructuredSectionsPanel heading="Explanation" sections={explanation} />
      )}

      {showAnswer && answer_note?.trim() && (
        <section className="rounded-lg border border-dashed border-border px-4 py-3">
          <FieldBlock label="Answer note" text={answer_note} />
        </section>
      )}
    </div>
  );
}
