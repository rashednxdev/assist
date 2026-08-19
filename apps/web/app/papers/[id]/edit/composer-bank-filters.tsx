'use client';

import { QUESTION_REVIEW_STATUSES } from '@ibas/shared-constants';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface ComposerBankTypeOption {
  id: string;
  code: string;
  name: string;
}

export interface ComposerBankSubjectOption {
  id: string;
  label: string;
}

const STATUS_LABEL: Record<(typeof QUESTION_REVIEW_STATUSES)[number], string> = {
  draft: 'Draft',
  quality_check: 'Quality check',
  published: 'Published',
};

export function toggleFilterValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function selectedOptionValues(select: HTMLSelectElement): string[] {
  return [...select.selectedOptions].map((o) => o.value);
}

export function applyComposerBankQuery(
  params: URLSearchParams,
  filters: {
    q?: string;
    reviewStatuses?: string[];
    typeCodes?: string[];
    subjectIds?: string[];
  },
) {
  if (filters.q?.trim()) params.set('q', filters.q.trim());
  if (filters.reviewStatuses?.length) params.set('review_status', filters.reviewStatuses.join(','));
  if (filters.typeCodes?.length) params.set('question_type_code', filters.typeCodes.join(','));
  if (filters.subjectIds?.length) params.set('exam_subject_id', filters.subjectIds.join(','));
}

/**
 * Paper composer question-bank filters: optional text search and one-or-more matching
 * on status, type, and subject (OR within a filter, AND across filters).
 */
export function ComposerBankFilters({
  search,
  onSearchChange,
  searchPlaceholder = 'Search question text…',
  reviewStatuses,
  onReviewStatusesChange,
  typeCodes,
  onTypeCodesChange,
  types,
  hideTypeFilter,
  subjectIds,
  onSubjectIdsChange,
  subjects,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  reviewStatuses: string[];
  onReviewStatusesChange: (values: string[]) => void;
  typeCodes: string[];
  onTypeCodesChange: (values: string[]) => void;
  types: ComposerBankTypeOption[];
  hideTypeFilter?: boolean;
  subjectIds: string[];
  onSubjectIdsChange: (values: string[]) => void;
  subjects: ComposerBankSubjectOption[];
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="composer-bank-search">Search</Label>
        <Input
          id="composer-bank-search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
        />
      </div>
      <p className="text-xs text-muted">
        Use the search box and/or one or more filters. Several values in the same filter match any
        of them.
      </p>
      <div className={`grid gap-3 ${hideTypeFilter ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
        <fieldset className="space-y-1.5">
          <legend className="text-sm font-medium">Question status</legend>
          <div className="flex flex-col gap-1.5 rounded-md border border-input bg-background px-3 py-2">
            {QUESTION_REVIEW_STATUSES.map((status) => (
              <label key={status} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewStatuses.includes(status)}
                  onChange={() => onReviewStatusesChange(toggleFilterValue(reviewStatuses, status))}
                />
                {STATUS_LABEL[status]}
              </label>
            ))}
          </div>
        </fieldset>
        {!hideTypeFilter && (
          <div className="space-y-1.5">
            <Label htmlFor="composer-bank-type">Question type</Label>
            <select
              id="composer-bank-type"
              multiple
              value={typeCodes}
              onChange={(e) => onTypeCodesChange(selectedOptionValues(e.target))}
              className="min-h-[6.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {types.map((t) => (
                <option key={t.id} value={t.code}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="composer-bank-subject">Subject</Label>
          <select
            id="composer-bank-subject"
            multiple
            value={subjectIds}
            onChange={(e) => onSubjectIdsChange(selectedOptionValues(e.target))}
            className="min-h-[6.5rem] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
