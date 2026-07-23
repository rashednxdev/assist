import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { OPTION_KEYS } from '@ibas/shared-constants';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { BookBadge } from '@/components/books/BookBadge';
import { ReviewStatusBadge } from '@/components/questions/ReviewStatusBadge';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import {
  fetchQuestionForEdit,
  transitionQuestionReviewStatus,
  updateQuestionContent,
  type ReviewTransition,
} from '@/lib/question-edit-api';
import type { ExplanationSection, QuestionDetail, ReviewStatus } from '@/types/questions';
import { colors, spacing } from '@/theme';

interface OptionRow {
  option_key: string;
  option_text_en: string;
  option_text_bn: string;
}

interface SectionRow {
  title: string;
  details: string;
  note?: string;
  subsections?: ExplanationSection['subsections'];
}

function toOptionRows(item: QuestionDetail): OptionRow[] {
  if (item.options.length > 0) {
    return item.options.map((o) => ({
      option_key: o.option_key,
      option_text_en: o.option_text_en,
      option_text_bn: o.option_text_bn ?? '',
    }));
  }
  return [
    { option_key: 'a', option_text_en: '', option_text_bn: '' },
    { option_key: 'b', option_text_en: '', option_text_bn: '' },
  ];
}

function toSectionRows(sections?: ExplanationSection[]): SectionRow[] {
  if (!sections || sections.length === 0) return [{ title: '', details: '' }];
  return sections.map((s) => ({
    title: s.title ?? '',
    details: s.details ?? s.content ?? '',
    note: s.note,
    subsections: s.subsections,
  }));
}

const TRANSITION_LABEL: Record<ReviewTransition, string> = {
  'submit-for-quality-check': 'Submit for quality check',
  'return-to-draft': 'Send back to draft',
  publish: 'Publish',
  unpublish: 'Send to quality check',
};

export default function QuestionUpdateEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { canUpdate } = useAuth();
  const editable = canUpdate('QUESTION_EDIT');

  const [item, setItem] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [bodyEn, setBodyEn] = useState('');
  const [bodyBn, setBodyBn] = useState('');
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [correctOptionKey, setCorrectOptionKey] = useState('');
  const [correctTrueFalse, setCorrectTrueFalse] = useState<'true' | 'false'>('true');
  const [sections, setSections] = useState<SectionRow[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [transitioning, setTransitioning] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError('');
    fetchQuestionForEdit(id)
      .then((data) => {
        setItem(data);
        setBodyEn(data.body_en);
        setBodyBn(data.body_bn ?? '');
        setOptions(toOptionRows(data));
        setCorrectOptionKey(data.correct_option_key ?? 'a');
        setCorrectTrueFalse(data.correct_true_false ?? 'true');
        setSections(toSectionRows(data.model_answer_sections));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load question'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const isMcq = item?.question_type_code === 'MCQ';
  const isTf = item?.question_type_code === 'TF';
  const isDifferences = item?.question_type_code === 'DIFFERENCES';
  const isUnsupportedOptions = Boolean(item?.has_options) && !isMcq && !isTf;
  const isDescriptiveLike = !!item && !item.has_options && !isDifferences;

  function updateOption(index: number, field: 'option_text_en' | 'option_text_bn', value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, [field]: value } : o)));
  }

  function addOption() {
    setOptions((prev) => {
      if (prev.length >= OPTION_KEYS.length) return prev;
      const nextKey = OPTION_KEYS[prev.length];
      return [...prev, { option_key: nextKey, option_text_en: '', option_text_bn: '' }];
    });
  }

  function removeOption(index: number) {
    setOptions((prev) => {
      if (prev.length <= 2) return prev;
      const next = prev.filter((_, i) => i !== index).map((o, i) => ({ ...o, option_key: OPTION_KEYS[i] }));
      if (!next.some((o) => o.option_key === correctOptionKey)) {
        setCorrectOptionKey(next[0]?.option_key ?? 'a');
      }
      return next;
    });
  }

  function updateSection(index: number, field: 'title' | 'details', value: string) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function addSection() {
    setSections((prev) => [...prev, { title: '', details: '' }]);
  }

  function removeSection(index: number) {
    setSections((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  async function handleSave() {
    if (!id || !item) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const payload: Parameters<typeof updateQuestionContent>[1] = {
        body_en: bodyEn.trim(),
        body_bn: bodyBn.trim() || undefined,
      };
      if (isMcq) {
        payload.options = options.map((o) => ({
          option_key: o.option_key,
          option_text_en: o.option_text_en.trim(),
          option_text_bn: o.option_text_bn.trim() || undefined,
        }));
        payload.correct_option_key = correctOptionKey;
      } else if (isTf) {
        payload.correct_true_false = correctTrueFalse;
      } else if (isDescriptiveLike) {
        payload.model_answer_sections = sections.map((s) => ({
          title: s.title,
          details: s.details,
          note: s.note,
          subsections: s.subsections ?? [],
        }));
      }
      const updated = await updateQuestionContent(id, payload);
      setItem(updated);
      setSaveMessage('Saved');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(action: ReviewTransition) {
    if (!id) return;
    setTransitioning(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const res = await transitionQuestionReviewStatus(id, action);
      setItem((prev) => (prev ? { ...prev, review_status: res.review_status, is_published: res.is_published } : prev));
      setSaveMessage(TRANSITION_LABEL[action] + ' — done');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setTransitioning(false);
    }
  }

  if (loading) return <BookLoading />;
  if (loadError) return <BookError message={loadError} />;
  if (!item) return <BookEmpty title="Question not found" />;

  const status = item.review_status ?? 'draft';
  const busy = saving || transitioning;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <BookBadge label={item.question_type_name ?? item.question_type_code} variant="muted" />
        <ReviewStatusBadge status={status} />
      </View>

      {!editable ? (
        <View style={styles.noticeBanner}>
          <Text style={styles.noticeText}>
            You have view-only access to Question update. Ask an admin to enable update permission to edit.
          </Text>
        </View>
      ) : null}

      {saveError ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{saveError}</Text>
        </View>
      ) : null}
      {saveMessage ? (
        <View style={styles.successBanner}>
          <Text style={styles.successBannerText}>{saveMessage}</Text>
        </View>
      ) : null}

      <View style={styles.panel}>
        <TextField
          label="Question (English)"
          value={bodyEn}
          onChangeText={setBodyEn}
          multiline
          numberOfLines={4}
          editable={editable && !busy}
        />
        <TextField
          label="Question (Bangla)"
          value={bodyBn}
          onChangeText={setBodyBn}
          multiline
          numberOfLines={4}
          editable={editable && !busy}
        />
      </View>

      {isMcq ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Options &amp; correct answer</Text>
          {options.map((opt, index) => {
            const isCorrect = correctOptionKey === opt.option_key;
            return (
              <View key={opt.option_key} style={styles.optionRow}>
                <Pressable
                  style={[styles.correctToggle, isCorrect && styles.correctToggleActive]}
                  disabled={!editable || busy}
                  onPress={() => setCorrectOptionKey(opt.option_key)}
                  accessibilityLabel={`Mark option ${opt.option_key.toUpperCase()} as correct`}
                >
                  <Text style={[styles.correctToggleText, isCorrect && styles.correctToggleTextActive]}>
                    {opt.option_key.toUpperCase()}
                  </Text>
                </Pressable>
                <View style={styles.optionInputs}>
                  <TextField
                    label=""
                    value={opt.option_text_en}
                    onChangeText={(v) => updateOption(index, 'option_text_en', v)}
                    placeholder={`Option ${opt.option_key.toUpperCase()} (English)`}
                    editable={editable && !busy}
                  />
                  <TextField
                    label=""
                    value={opt.option_text_bn}
                    onChangeText={(v) => updateOption(index, 'option_text_bn', v)}
                    placeholder={`Option ${opt.option_key.toUpperCase()} (Bangla, optional)`}
                    editable={editable && !busy}
                  />
                </View>
                {options.length > 2 && editable ? (
                  <Pressable onPress={() => removeOption(index)} hitSlop={8} disabled={busy}>
                    <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
          {options.length < OPTION_KEYS.length && editable ? (
            <Pressable style={styles.addBtn} onPress={addOption} disabled={busy}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addBtnText}>Add option</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isTf ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Correct answer</Text>
          <View style={styles.tfRow}>
            {(['true', 'false'] as const).map((v) => (
              <Pressable
                key={v}
                style={[styles.tfPill, correctTrueFalse === v && styles.tfPillActive]}
                disabled={!editable || busy}
                onPress={() => setCorrectTrueFalse(v)}
              >
                <Text style={[styles.tfPillText, correctTrueFalse === v && styles.tfPillTextActive]}>
                  {v === 'true' ? 'True' : 'False'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {isDescriptiveLike ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Model answer</Text>
          {sections.map((sec, index) => (
            <View key={index} style={styles.sectionBlock}>
              <View style={styles.sectionBlockHeader}>
                <Text style={styles.sectionBlockLabel}>Section {index + 1}</Text>
                {sections.length > 1 && editable ? (
                  <Pressable onPress={() => removeSection(index)} hitSlop={8} disabled={busy}>
                    <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                  </Pressable>
                ) : null}
              </View>
              <TextField
                label=""
                value={sec.title}
                onChangeText={(v) => updateSection(index, 'title', v)}
                placeholder="Section heading (optional)"
                editable={editable && !busy}
              />
              <TextField
                label=""
                value={sec.details}
                onChangeText={(v) => updateSection(index, 'details', v)}
                placeholder="Answer text"
                multiline
                numberOfLines={5}
                editable={editable && !busy}
              />
            </View>
          ))}
          {editable ? (
            <Pressable style={styles.addBtn} onPress={addSection} disabled={busy}>
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.addBtnText}>Add section</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {isDifferences ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Comparison table</Text>
          <Text style={styles.mutedText}>
            The comparison table for DIFFERENCES questions can only be edited from the web admin. You can
            still edit the question text above and change its review status below.
          </Text>
        </View>
      ) : null}

      {isUnsupportedOptions ? (
        <View style={styles.panel}>
          <Text style={styles.mutedText}>
            This question type&apos;s answer format isn&apos;t supported for mobile editing yet. Edit the
            question text above, or use the web admin for the answer.
          </Text>
        </View>
      ) : null}

      {editable ? (
        <Button title={saving ? 'Saving…' : 'Save changes'} onPress={() => void handleSave()} loading={saving} disabled={busy} />
      ) : null}

      {editable ? (
        <View style={styles.panel}>
          <Text style={styles.sectionTitle}>Review status</Text>
          <View style={styles.transitionRow}>
            {status === 'draft' ? (
              <Button
                variant="secondary"
                title={TRANSITION_LABEL['submit-for-quality-check']}
                onPress={() => void handleTransition('submit-for-quality-check')}
                disabled={busy}
                loading={transitioning}
              />
            ) : null}
            {status === 'quality_check' ? (
              <>
                <Button
                  variant="secondary"
                  title={TRANSITION_LABEL['return-to-draft']}
                  onPress={() => void handleTransition('return-to-draft')}
                  disabled={busy}
                  style={styles.transitionBtn}
                />
                <Button
                  title={TRANSITION_LABEL.publish}
                  onPress={() => void handleTransition('publish')}
                  disabled={busy}
                  style={styles.transitionBtn}
                />
              </>
            ) : null}
            {status === 'published' ? (
              <Button
                variant="secondary"
                title={TRANSITION_LABEL.unpublish}
                onPress={() => void handleTransition('unpublish')}
                disabled={busy}
              />
            ) : null}
          </View>
        </View>
      ) : null}

      <Pressable style={styles.backLink} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={16} color={colors.primary} />
        <Text style={styles.backLinkText}>Back to list</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 8,
  },
  noticeBanner: {
    backgroundColor: '#fef3c7',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fcd34d',
    padding: spacing.sm,
  },
  noticeText: {
    color: '#92400e',
    fontSize: 12,
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: '#fde8e8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#f5b5b5',
    padding: spacing.sm,
  },
  errorBannerText: {
    color: '#b42318',
    fontSize: 12,
    fontWeight: '600',
  },
  successBanner: {
    backgroundColor: '#ecfdf3',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#a8d5b5',
    padding: spacing.sm,
  },
  successBannerText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: '600',
  },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  mutedText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  optionInputs: {
    flex: 1,
    gap: 6,
  },
  correctToggle: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  correctToggleActive: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  correctToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  correctToggleTextActive: {
    color: colors.white,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  tfRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tfPill: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.background,
  },
  tfPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tfPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  tfPillTextActive: {
    color: colors.white,
  },
  sectionBlock: {
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  sectionBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionBlockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  transitionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  transitionBtn: {
    flex: 1,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  backLinkText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
});
