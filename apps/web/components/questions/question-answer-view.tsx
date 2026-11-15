import type { ComparisonTable, ExplanationSection } from '@ibas/shared-types';
import { hasComparisonTableContent, hasExplanationContent, hasProcessContent } from '@ibas/shared-types';
import { ComparisonTableView } from '@/components/questions/comparison-table-view';
import { ProcessFlowPreview } from '@/components/books/process-flow-preview';
import { MarkupText } from '@/components/shared/markup-text';

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

function TextBlock({
  text,
  className = '',
}: {
  text?: string;
  className?: string;
}) {
  if (!text?.trim()) return null;
  return (
    <div className={`text-sm leading-relaxed text-foreground ${className}`}>
      <MarkupText text={text} />
    </div>
  );
}

function SubsectionBlock({ sub }: { sub: ExplanationSection['subsections'][number] }) {
  const hasContent = sub.subtitle?.trim() || sub.details?.trim() || sub.note?.trim();
  if (!hasContent) return null;

  return (
    <div className="space-y-3 rounded-lg border border-[#e2e8f0] bg-[#f4f7fb] p-3">
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
    hasComparisonTableContent(section.table) ||
    hasProcessContent(section.process) ||
    section.subsections?.some((sub) => sub.subtitle?.trim() || sub.details?.trim() || sub.note?.trim());

  if (!hasContent) return null;

  return (
    <div className="space-y-4">
      {section.title?.trim() && <h4 className="text-base font-semibold text-foreground">{section.title}</h4>}
      <TextBlock text={section.details} />
      <TextBlock text={section.note} />
      {hasComparisonTableContent(section.table) && <ComparisonTableView table={section.table} label="" />}
      {hasProcessContent(section.process) && (
        <div className="rounded-lg border border-[#e2e8f0] bg-white p-3">
          {section.process?.title?.trim() && (
            <p className="mb-1 text-sm font-semibold text-foreground">{section.process.title}</p>
          )}
          <TextBlock text={section.process?.details} />
          <ProcessFlowPreview steps={section.process?.steps ?? []} />
        </div>
      )}

      {section.subsections?.length > 0 && (
        <div className="space-y-3 border-l-2 border-[#e2e8f0] pl-4">
          {section.subsections.map((sub, subIndex) => (
            <SubsectionBlock key={subIndex} sub={sub} />
          ))}
        </div>
      )}
    </div>
  );
}

export function StructuredSectionsPanel({
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
      className="space-y-5 rounded-[14px] border border-[#e2e8f0] bg-white p-4"
    >
      <div
        className={`text-xs font-bold uppercase tracking-wide ${
          variant === 'primary' ? 'text-[#0f5c8c]' : 'text-[#64748b]'
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
  const hasNestedComparison = modelAnswer.some((s) => hasComparisonTableContent(s.table));
  const showComparisonModel =
    showAnswer &&
    !has_options &&
    !hasNestedComparison &&
    hasComparisonTableContent(model_answer_comparison);
  const showStructuredModelAnswer =
    showAnswer && !has_options && hasExplanationContent(modelAnswer);

  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-[14px] border border-[#e2e8f0] bg-white p-4 shadow-sm">
        <TextBlock text={body_en} className="text-base font-semibold text-[#0f172a]" />
        {body_bn?.trim() ? <TextBlock text={body_bn} className="text-[#64748b]" /> : null}
      </section>

      {has_options && options.length > 0 && (
        <section className="space-y-2 rounded-[14px] border border-[#e2e8f0] bg-white p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Options</div>
          <div className="space-y-2">
            {options.map((opt) => {
              const isCorrect = showAnswer && opt.is_correct;
              return (
                <div
                  key={opt.id ?? opt.option_key}
                  className={`rounded-[10px] border p-3 ${
                    isCorrect ? 'border-[#16a34a] bg-[#ecfdf3]' : 'border-[#e2e8f0] bg-[#f4f7fb]'
                  }`}
                >
                  <div className="flex gap-2">
                    <span className={`shrink-0 font-bold uppercase ${isCorrect ? 'text-[#16a34a]' : 'text-[#64748b]'}`}>
                      {opt.option_key}.
                    </span>
                    <TextBlock
                      text={opt.option_text_en}
                      className={`min-w-0 flex-1 ${isCorrect ? 'font-bold text-[#16a34a]' : 'text-[#0f172a]'}`}
                    />
                  </div>
                  {opt.option_text_bn ? (
                    <TextBlock text={opt.option_text_bn} className="mt-1 text-[#64748b]" />
                  ) : null}
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
        <section className="space-y-2 rounded-[14px] border border-[#e2e8f0] bg-white p-4">
          <div className="text-xs font-bold uppercase tracking-wide text-[#64748b]">Note</div>
          <TextBlock text={answer_note} />
        </section>
      )}
    </div>
  );
}
