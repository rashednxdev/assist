'use client';

import { Plus, Trash2 } from 'lucide-react';
import type { ExplanationSection } from '@ibas/shared-types';
import { emptyExplanationSection, emptyExplanationSubsection } from '@ibas/shared-types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface ExplanationSectionsEditorProps {
  sections: ExplanationSection[];
  onChange: (sections: ExplanationSection[]) => void;
  disabled?: boolean;
}

export function ExplanationSectionsEditor({ sections, onChange, disabled }: ExplanationSectionsEditorProps) {
  function updateSection(index: number, patch: Partial<ExplanationSection>) {
    onChange(sections.map((section, i) => (i === index ? { ...section, ...patch } : section)));
  }

  function removeSection(index: number) {
    onChange(sections.filter((_, i) => i !== index));
  }

  function addSection() {
    onChange([...sections, emptyExplanationSection()]);
  }

  function updateSubsection(sectionIndex: number, subIndex: number, patch: Partial<ExplanationSection['subsections'][number]>) {
    const section = sections[sectionIndex];
    if (!section) return;
    const subsections = section.subsections.map((sub, i) => (i === subIndex ? { ...sub, ...patch } : sub));
    updateSection(sectionIndex, { subsections });
  }

  function addSubsection(sectionIndex: number) {
    const section = sections[sectionIndex];
    if (!section) return;
    updateSection(sectionIndex, {
      subsections: [...section.subsections, emptyExplanationSubsection()],
    });
  }

  function removeSubsection(sectionIndex: number, subIndex: number) {
    const section = sections[sectionIndex];
    if (!section) return;
    updateSection(sectionIndex, {
      subsections: section.subsections.filter((_, i) => i !== subIndex),
    });
  }

  return (
    <div className="space-y-4">
      {sections.length === 0 && (
        <p className="text-sm text-muted">
          No explanation blocks yet. Add a title section, then optional sub-titles under it.
        </p>
      )}

      {sections.map((section, sectionIndex) => (
        <div key={sectionIndex} className="rounded-xl border border-border bg-slate-50/40 p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-foreground">Title {sectionIndex + 1}</p>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive"
              disabled={disabled}
              onClick={() => removeSection(sectionIndex)}
            >
              <Trash2 className="h-4 w-4" />
              Remove title
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input
              disabled={disabled}
              value={section.title}
              placeholder="e.g. Legal basis"
              onChange={(e) => updateSection(sectionIndex, { title: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Details</Label>
            <textarea
              disabled={disabled}
              rows={3}
              value={section.details ?? ''}
              placeholder="Main explanation for this title"
              onChange={(e) => updateSection(sectionIndex, { details: e.target.value })}
              className="ibas-textarea min-h-[88px]"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Note</Label>
            <textarea
              disabled={disabled}
              rows={2}
              value={section.note ?? ''}
              placeholder="Optional note for this title"
              onChange={(e) => updateSection(sectionIndex, { note: e.target.value })}
              className="ibas-textarea min-h-[72px]"
            />
          </div>

          <div className="space-y-3 border-t border-border pt-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-muted">Sub-titles under this title</p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={disabled}
                onClick={() => addSubsection(sectionIndex)}
              >
                <Plus className="h-4 w-4" />
                Add sub-title
              </Button>
            </div>

            {section.subsections.length === 0 && (
              <p className="text-xs text-muted">No sub-titles yet.</p>
            )}

            {section.subsections.map((sub, subIndex) => (
              <div key={subIndex} className="rounded-lg border border-dashed border-border bg-background p-3 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Sub-title {sectionIndex + 1}.{subIndex + 1}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive"
                    disabled={disabled}
                    onClick={() => removeSubsection(sectionIndex, subIndex)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label>Sub-title</Label>
                  <Input
                    disabled={disabled}
                    value={sub.subtitle}
                    placeholder="e.g. Rule 45(1)"
                    onChange={(e) => updateSubsection(sectionIndex, subIndex, { subtitle: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Details</Label>
                  <textarea
                    disabled={disabled}
                    rows={2}
                    value={sub.details ?? ''}
                    placeholder="Details for this sub-title"
                    onChange={(e) => updateSubsection(sectionIndex, subIndex, { details: e.target.value })}
                    className="ibas-textarea min-h-[72px] text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Note</Label>
                  <textarea
                    disabled={disabled}
                    rows={2}
                    value={sub.note ?? ''}
                    placeholder="Optional note"
                    onChange={(e) => updateSubsection(sectionIndex, subIndex, { note: e.target.value })}
                    className="ibas-textarea min-h-[64px] text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" disabled={disabled} onClick={addSection}>
        <Plus className="h-4 w-4" />
        Add title
      </Button>
    </div>
  );
}
