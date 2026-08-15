import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { OPTION_KEYS } from '@ibas/shared-constants';
import {
  hasComparisonTableContent,
  hasProcessContent,
  mergeComparisonIntoModelAnswerSections,
  type ComparisonTable as SharedComparisonTable,
  type ExplanationSection as SharedExplanationSection,
} from '@ibas/shared-types';
import { BookEmpty, BookError, BookLoading } from '@/components/books/BookStates';
import { BookBadge } from '@/components/books/BookBadge';
import { BookRichText } from '@/components/books/BookRichText';
import { ReviewStatusBadge } from '@/components/questions/ReviewStatusBadge';
import { CollapsibleSection } from '@/components/questions/CollapsibleSection';
import { EditableLabel } from '@/components/questions/EditableLabel';
import {
  ComparisonTableEditor,
  emptyComparisonTable,
} from '@/components/questions/ComparisonTableEditor';
import { ComparisonTableEditorModal } from '@/components/questions/ComparisonTableEditorModal';
import { ComparisonTableAnswer } from '@/components/questions/ComparisonTableAnswer';
import { emptyExplanationProcess } from '@/components/questions/ProcessStepsEditor';
import { ProcessEditorModal } from '@/components/questions/ProcessEditorModal';
import { ProcessFlowPreview } from '@/components/books/ProcessFlowPreview';
import { MarkupInstructionsModal } from '@/components/questions/MarkupInstructionsModal';
import { ModelAnswerLinkPanel } from '@/components/questions/ModelAnswerLinkPanel';
import { TextField } from '@/components/ui/TextField';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/lib/auth-context';
import { KeyboardScrollProvider, useKeyboardScroll } from '@/lib/keyboard-scroll';
import {
  fetchQuestionForEdit,
  transitionQuestionReviewStatus,
  trashQuestion,
  updateQuestionContent,
  type ReviewTransition,
} from '@/lib/question-edit-api';
import type {
  ComparisonTable,
  ExplanationProcess,
  ExplanationSection,
  QuestionDetail,
  ReviewStatus,
} from '@/types/questions';
import { colors, spacing } from '@/theme';

interface OptionRow {
  option_key: string;
  option_text_en: string;
  option_text_bn: string;
}

interface SubsectionRow {
  subtitle: string;
  details: string;
  note?: string;
}

interface SectionRow {
  title: string;
  details: string;
  note?: string;
  subsections: SubsectionRow[];
  table?: ComparisonTable;
  process?: ExplanationProcess;
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
  if (!sections || sections.length === 0) return [{ title: '', details: '', subsections: [] }];
  return sections.map((s) => ({
    title: s.title ?? '',
    details: s.details ?? s.content ?? '',
    note: s.note,
    subsections: (s.subsections ?? []).map((sub) => ({
      subtitle: sub.subtitle ?? '',
      details: sub.details ?? '',
      note: sub.note,
    })),
    // Legacy / partial API payloads may omit columns/rows/steps — normalize so edit + preview never crash.
    table: s.table
      ? {
          ...s.table,
          columns: s.table.columns ?? [],
          rows: (s.table.rows ?? []).map((row) => ({
            feature: row.feature ?? '',
            values: row.values ?? [],
          })),
        }
      : undefined,
    process: s.process
      ? {
          title: s.process.title,
          details: s.process.details,
          steps: s.process.steps ?? [],
        }
      : undefined,
  }));
}

function hasTableContent(table?: ComparisonTable) {
  return hasComparisonTableContent(table);
}

/** Inline comparison-table editor for Question Update (same fields as web). */
function SectionComparisonTableBlock({
  table,
  editable,
  busy,
  onChange,
  onRemove,
  onExpand,
}: {
  table?: ComparisonTable;
  editable: boolean;
  busy: boolean;
  onChange: (table: ComparisonTable) => void;
  onRemove: () => void;
  onExpand: () => void;
}) {
  if (!table) {
    if (!editable) return null;
    return (
      <Pressable
        style={styles.addBtn}
        onPress={() => onChange(emptyComparisonTable())}
        disabled={busy}
      >
        <Ionicons name="grid-outline" size={16} color={colors.primary} />
        <Text style={styles.addBtnText}>Add comparison table</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.tableEditorBlock}>
      <View style={styles.tableSummaryRow}>
        <View style={styles.tableSummaryInfo}>
          <Ionicons name="grid-outline" size={16} color={colors.primary} />
          <Text style={styles.tableSummaryText}>Comparison table</Text>
        </View>
        {editable ? (
          <View style={styles.tableSummaryActions}>
            <Pressable onPress={onExpand} hitSlop={8} disabled={busy} accessibilityLabel="Edit table full screen">
              <Ionicons name="expand-outline" size={20} color={colors.primary} />
            </Pressable>
            <Pressable onPress={onRemove} hitSlop={8} disabled={busy} accessibilityLabel="Remove table">
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </Pressable>
          </View>
        ) : null}
      </View>
      <ComparisonTableEditor value={table} onChange={onChange} disabled={!editable || busy} />
    </View>
  );
}

/** Read-only render matching how Question Bank shows a model answer / explanation to end users. */
function renderSectionPreview(sections: SectionRow[]) {
  return sections.map((sec, idx) => (
    <View key={idx} style={previewStyles.block}>
      {sec.title?.trim() ? <Text style={previewStyles.heading}>{sec.title}</Text> : null}
      {sec.details?.trim() ? <BookRichText html={sec.details} style={previewStyles.text} /> : null}
      {sec.note?.trim() ? <BookRichText html={sec.note} style={previewStyles.note} /> : null}
      {hasTableContent(sec.table) ? <ComparisonTableAnswer table={sec.table} /> : null}
      {sec.subsections.map((sub, subIdx) => (
        <View key={subIdx} style={previewStyles.subBlock}>
          {sub.subtitle?.trim() ? <Text style={previewStyles.subHeading}>{sub.subtitle}</Text> : null}
          {sub.details?.trim() ? <BookRichText html={sub.details} style={previewStyles.text} /> : null}
          {sub.note?.trim() ? <BookRichText html={sub.note} style={previewStyles.note} /> : null}
        </View>
      ))}
    </View>
  ));
}

/** Every process across a list of sections, shown together at the end of the answer preview —
 * matching how Question Bank presents them (steps block, not scattered per section). */
function renderProcessesPreview(sections: SectionRow[]) {
  const processes = sections.map((s) => s.process).filter((p) => hasProcessContent(p));
  if (processes.length === 0) return null;
  return (
    <View style={previewStyles.block}>
      {processes.map((proc, idx) => (
        <View key={idx} style={previewStyles.subBlock}>
          {proc?.title?.trim() && proc.title.trim().toLowerCase() !== 'process' ? (
            <Text style={previewStyles.subHeading}>{proc.title}</Text>
          ) : null}
          {proc?.details?.trim() ? <BookRichText html={proc.details} style={previewStyles.text} /> : null}
          <ProcessFlowPreview steps={proc?.steps ?? []} />
        </View>
      ))}
    </View>
  );
}

function hasPreviewContent(sections: SectionRow[]) {
  return sections.some(
    (s) =>
      s.title.trim() ||
      s.details.trim() ||
      hasTableContent(s.table) ||
      hasProcessContent(s.process) ||
      s.subsections.some((sub) => sub.subtitle.trim() || sub.details.trim()),
  );
}

/** Shared add/update/remove handlers for a top-level sections array (model answer or explanation). */
function useSectionHandlers(setSections: React.Dispatch<React.SetStateAction<SectionRow[]>>) {
  const update = useCallback(
    (index: number, field: 'title' | 'details', value: string) => {
      setSections((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
    },
    [setSections],
  );

  const removeTitle = useCallback(
    (index: number) => {
      setSections((prev) => prev.map((s, i) => (i === index ? { ...s, title: '' } : s)));
    },
    [setSections],
  );

  const add = useCallback(() => {
    setSections((prev) => [...prev, { title: '', details: '', subsections: [] }]);
  }, [setSections]);

  const remove = useCallback(
    (index: number) => {
      setSections((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
    },
    [setSections],
  );

  const updateSub = useCallback(
    (sectionIndex: number, subIndex: number, field: 'subtitle' | 'details', value: string) => {
      setSections((prev) =>
        prev.map((s, i) =>
          i === sectionIndex
            ? { ...s, subsections: s.subsections.map((sub, j) => (j === subIndex ? { ...sub, [field]: value } : sub)) }
            : s,
        ),
      );
    },
    [setSections],
  );

  const addSub = useCallback(
    (sectionIndex: number) => {
      setSections((prev) =>
        prev.map((s, i) =>
          i === sectionIndex ? { ...s, subsections: [...s.subsections, { subtitle: '', details: '' }] } : s,
        ),
      );
    },
    [setSections],
  );

  const removeSub = useCallback(
    (sectionIndex: number, subIndex: number) => {
      setSections((prev) =>
        prev.map((s, i) =>
          i === sectionIndex ? { ...s, subsections: s.subsections.filter((_, j) => j !== subIndex) } : s,
        ),
      );
    },
    [setSections],
  );

  const setTable = useCallback(
    (index: number, table: ComparisonTable | undefined) => {
      setSections((prev) => prev.map((s, i) => (i === index ? { ...s, table } : s)));
    },
    [setSections],
  );

  const setProcess = useCallback(
    (index: number, process: ExplanationProcess | undefined) => {
      setSections((prev) => prev.map((s, i) => (i === index ? { ...s, process } : s)));
    },
    [setSections],
  );

  return { update, removeTitle, add, remove, updateSub, addSub, removeSub, setTable, setProcess };
}

const TRANSITION_LABEL: Record<ReviewTransition, string> = {
  'submit-for-quality-check': 'Submit for quality check',
  'return-to-draft': 'Send back to draft',
  publish: 'Publish',
  unpublish: 'Send to quality check',
};

export default function QuestionUpdateEditScreen() {
  return (
    <KeyboardScrollProvider>
      <QuestionUpdateEditBody />
    </KeyboardScrollProvider>
  );
}

function QuestionUpdateEditBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const navigation = useNavigation();
  const { canUpdate, canDelete } = useAuth();
  const editable = canUpdate('QUESTION_EDIT');
  const canTrash = canDelete('QUESTION_EDIT');
  const keyboardScroll = useKeyboardScroll();

  const [item, setItem] = useState<QuestionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [bodyEn, setBodyEn] = useState('');
  const [options, setOptions] = useState<OptionRow[]>([]);
  const [correctOptionKey, setCorrectOptionKey] = useState('');
  const [correctTrueFalse, setCorrectTrueFalse] = useState<'true' | 'false'>('true');
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [explanationSections, setExplanationSections] = useState<SectionRow[]>([]);
  const [previewModelAnswer, setPreviewModelAnswer] = useState(false);
  const [previewExplanation, setPreviewExplanation] = useState(false);
  const [editingTable, setEditingTable] = useState<{ scope: 'model' | 'explanation'; index: number } | null>(
    null,
  );
  const [editingProcess, setEditingProcess] = useState<{ scope: 'model' | 'explanation'; index: number } | null>(
    null,
  );

  const modelAnswerHandlers = useSectionHandlers(setSections);
  const explanationHandlers = useSectionHandlers(setExplanationSections);

  const editingTableValue =
    editingTable?.scope === 'model'
      ? sections[editingTable.index]?.table
      : editingTable?.scope === 'explanation'
        ? explanationSections[editingTable.index]?.table
        : undefined;

  function handleEditingTableChange(table: ComparisonTable) {
    if (!editingTable) return;
    const handlers = editingTable.scope === 'model' ? modelAnswerHandlers : explanationHandlers;
    handlers.setTable(editingTable.index, table);
  }

  // If full-screen table opens before the section has a table row, seed an empty one so edits persist.
  useEffect(() => {
    if (!editingTable) return;
    if (editingTable.scope === 'model') {
      setSections((prev) => {
        const cur = prev[editingTable.index];
        if (!cur || cur.table) return prev;
        return prev.map((s, i) =>
          i === editingTable.index ? { ...s, table: emptyComparisonTable() } : s,
        );
      });
      return;
    }
    setExplanationSections((prev) => {
      const cur = prev[editingTable.index];
      if (!cur || cur.table) return prev;
      return prev.map((s, i) =>
        i === editingTable.index ? { ...s, table: emptyComparisonTable() } : s,
      );
    });
  }, [editingTable]);

  const editingProcessValue =
    editingProcess?.scope === 'model'
      ? sections[editingProcess.index]?.process
      : editingProcess?.scope === 'explanation'
        ? explanationSections[editingProcess.index]?.process
        : undefined;

  function handleEditingProcessChange(process: ExplanationProcess) {
    if (!editingProcess) return;
    const handlers = editingProcess.scope === 'model' ? modelAnswerHandlers : explanationHandlers;
    handlers.setProcess(editingProcess.index, process);
  }

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const [showMarkupHelp, setShowMarkupHelp] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [trashing, setTrashing] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError('');
    fetchQuestionForEdit(id)
      .then((data) => {
        setItem(data);
        setBodyEn(data.body_en);
        setOptions(toOptionRows(data));
        setCorrectOptionKey(data.correct_option_key ?? 'a');
        setCorrectTrueFalse(data.correct_true_false ?? 'true');
        setSections(
          toSectionRows(
            mergeComparisonIntoModelAnswerSections(
              data.model_answer_sections as SharedExplanationSection[] | undefined,
              data.model_answer_comparison as SharedComparisonTable | undefined,
            ),
          ),
        );
        setExplanationSections(toSectionRows(data.explanation_sections));
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Failed to load question'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: '',
      headerTitleAlign: 'center',
      headerTitle: () => (
        <View style={headerStyles.bookChapterWrap}>
          {item?.book_name ? (
            <Text style={headerStyles.headerBookText} numberOfLines={1}>
              {item.book_name}
            </Text>
          ) : null}
          {item?.chapter_name ? (
            <Text style={headerStyles.headerChapterText} numberOfLines={1}>
              {item.chapter_number ? `${item.chapter_number}: ${item.chapter_name}` : item.chapter_name}
            </Text>
          ) : null}
          {!item?.book_name && !item?.chapter_name ? (
            <Text style={headerStyles.headerBookText}>Edit question</Text>
          ) : null}
        </View>
      ),
    });
  }, [navigation, item?.book_name, item?.chapter_number, item?.chapter_name]);

  const isMcq = item?.question_type_code === 'MCQ';
  const isTf = item?.question_type_code === 'TF';
  const isUnsupportedOptions = Boolean(item?.has_options) && !isMcq && !isTf;
  // Every non-option type (descriptive, DIFFERENCES, short note, …) uses the same model-answer editor.
  const isDescriptiveLike = !!item && !item.has_options;

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

  async function handleSave() {
    if (!id || !item) return;
    setSaving(true);
    setSaveError('');
    setSaveMessage('');
    try {
      const payload: Parameters<typeof updateQuestionContent>[1] = {
        body_en: bodyEn.trim(),
      };
      if (isMcq) {
        payload.options = options.map((o) => ({
          option_key: o.option_key,
          option_text_en: o.option_text_en.trim(),
          option_text_bn: o.option_text_bn.trim() || undefined,
        }));
        payload.correct_option_key = correctOptionKey;
        payload.explanation_sections = explanationSections.map((s) => ({
          title: s.title,
          details: s.details,
          note: s.note,
          subsections: s.subsections.map((sub) => ({
            subtitle: sub.subtitle,
            details: sub.details,
            note: sub.note,
          })),
          table: s.table,
          process: s.process,
        }));
      } else if (isTf) {
        payload.correct_true_false = correctTrueFalse;
        payload.explanation_sections = explanationSections.map((s) => ({
          title: s.title,
          details: s.details,
          note: s.note,
          subsections: s.subsections.map((sub) => ({
            subtitle: sub.subtitle,
            details: sub.details,
            note: sub.note,
          })),
          table: s.table,
          process: s.process,
        }));
      } else if (isDescriptiveLike) {
        payload.model_answer_sections = sections.map((s) => ({
          title: s.title,
          details: s.details,
          note: s.note,
          subsections: s.subsections.map((sub) => ({
            subtitle: sub.subtitle,
            details: sub.details,
            note: sub.note,
          })),
          table: s.table,
          process: s.process,
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
      setItem((prev) =>
        prev
          ? {
              ...prev,
              review_status: res.review_status,
              is_published: res.is_published,
              status_by_name: res.status_by_name,
            }
          : prev,
      );
      setSaveMessage(TRANSITION_LABEL[action] + ' — done');
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Status update failed');
    } finally {
      setTransitioning(false);
    }
  }

  async function doTrash() {
    if (!id) return;
    setTrashing(true);
    setSaveError('');
    try {
      await trashQuestion(id);
      router.back();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to move to trash');
    } finally {
      setTrashing(false);
    }
  }

  function handleTrash() {
    Alert.alert(
      'Move to trash?',
      'This question will be hidden from the Question Bank. An admin can restore it from the web admin trash bin.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Move to trash', style: 'destructive', onPress: () => void doTrash() },
      ],
    );
  }

  if (loading) return <BookLoading />;
  if (loadError) return <BookError message={loadError} />;
  if (!item) return <BookEmpty title="Question not found" />;

  const status = item.review_status ?? 'draft';
  const busy = saving || transitioning || trashing;

  return (
    <>
    <ScrollView
      ref={keyboardScroll?.scrollRef}
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: spacing.xl + (keyboardScroll?.keyboardInset ?? 0) },
      ]}
      onScroll={keyboardScroll?.onScroll}
      scrollEventThrottle={16}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerRow}>
        <BookBadge label={item.question_type_name ?? item.question_type_code} variant="muted" />
        <ReviewStatusBadge status={status} by={item.status_by_name} />
        {(item.used_in_papers ?? []).map((paper) => {
          const session =
            paper.session_label_en?.trim() ||
            paper.session_year?.trim() ||
            paper.session_label_bn?.trim() ||
            '';
          const label = session ? `${session} · ${paper.name}` : paper.name;
          return <BookBadge key={paper.id} label={label} variant="muted" />;
        })}
      </View>

      <Pressable style={styles.markupGuideBtn} onPress={() => setShowMarkupHelp(true)}>
        <Ionicons name="book-outline" size={16} color={colors.primary} />
        <Text style={styles.markupGuideBtnText}>Markup guide</Text>
      </Pressable>

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

      <CollapsibleSection title="Question text">
        <TextField
          label=""
          value={bodyEn}
          onChangeText={setBodyEn}
          multiline
          numberOfLines={5}
          editable={editable && !busy}
        />
      </CollapsibleSection>

      {isMcq ? (
        <CollapsibleSection title="Options & correct answer">
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
                    placeholder={`Option ${opt.option_key.toUpperCase()}`}
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
        </CollapsibleSection>
      ) : null}

      {isTf ? (
        <CollapsibleSection title="Correct answer">
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
        </CollapsibleSection>
      ) : null}

      {isMcq || isTf ? (
        <CollapsibleSection
          title="Explanation"
          right={
            hasPreviewContent(explanationSections) ? (
              <Pressable
                style={styles.previewToggleBtn}
                onPress={() => setPreviewExplanation((v) => !v)}
                hitSlop={8}
              >
                <Ionicons
                  name={previewExplanation ? 'create-outline' : 'eye-outline'}
                  size={15}
                  color={colors.primary}
                />
                <Text style={styles.previewToggleText}>{previewExplanation ? 'Edit' : 'Preview'}</Text>
              </Pressable>
            ) : undefined
          }
        >
          {previewExplanation ? (
            <View>
              {renderSectionPreview(explanationSections)}
              {renderProcessesPreview(explanationSections)}
            </View>
          ) : (
            <>
              {explanationSections.map((sec, index) => (
                <View key={index} style={styles.sectionBlock}>
                  <View style={styles.sectionBlockHeader}>
                    <Text style={styles.sectionBlockLabel}>Section {index + 1}</Text>
                    {explanationSections.length > 1 && editable ? (
                      <Pressable onPress={() => explanationHandlers.remove(index)} hitSlop={8} disabled={busy}>
                        <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                      </Pressable>
                    ) : null}
                  </View>
                  <EditableLabel
                    value={sec.title}
                    placeholder="Section heading (optional)"
                    onChange={(v) => explanationHandlers.update(index, 'title', v)}
                    onRemove={() => explanationHandlers.removeTitle(index)}
                    removeLabel="Clear heading"
                    editable={editable}
                    disabled={busy}
                  />
                  <TextField
                    label=""
                    value={sec.details}
                    onChangeText={(v) => explanationHandlers.update(index, 'details', v)}
                    placeholder="Explanation text"
                    multiline
                    numberOfLines={6}
                    editable={editable && !busy}
                  />
                  <SectionComparisonTableBlock
                    table={sec.table}
                    editable={editable}
                    busy={busy}
                    onChange={(table) => explanationHandlers.setTable(index, table)}
                    onRemove={() => explanationHandlers.setTable(index, undefined)}
                    onExpand={() => {
                      if (!sec.table) explanationHandlers.setTable(index, emptyComparisonTable());
                      setEditingTable({ scope: 'explanation', index });
                    }}
                  />
                  {sec.process ? (
                    <View style={styles.tableSummaryRow}>
                      <View style={styles.tableSummaryInfo}>
                        <Ionicons name="list-outline" size={16} color={colors.primary} />
                        <Text style={styles.tableSummaryText}>
                          Process • {(sec.process.steps ?? []).length} step
                          {(sec.process.steps ?? []).length === 1 ? '' : 's'}
                        </Text>
                      </View>
                      {editable ? (
                        <View style={styles.tableSummaryActions}>
                          <Pressable
                            onPress={() => setEditingProcess({ scope: 'explanation', index })}
                            hitSlop={8}
                            disabled={busy}
                          >
                            <Ionicons name="create-outline" size={20} color={colors.primary} />
                          </Pressable>
                          <Pressable
                            onPress={() => explanationHandlers.setProcess(index, undefined)}
                            hitSlop={8}
                            disabled={busy}
                          >
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : editable ? (
                    <Pressable
                      style={styles.addBtn}
                      onPress={() => {
                        explanationHandlers.setProcess(index, emptyExplanationProcess());
                        setEditingProcess({ scope: 'explanation', index });
                      }}
                      disabled={busy}
                    >
                      <Ionicons name="list-outline" size={16} color={colors.primary} />
                      <Text style={styles.addBtnText}>Add process</Text>
                    </Pressable>
                  ) : null}
                  {sec.subsections.map((sub, subIndex) => (
                    <View key={subIndex} style={styles.subsectionEditBlock}>
                      <Text style={styles.sectionBlockLabel}>Subsection {subIndex + 1}</Text>
                      <EditableLabel
                        value={sub.subtitle}
                        placeholder="Subsection heading"
                        onChange={(v) => explanationHandlers.updateSub(index, subIndex, 'subtitle', v)}
                        onRemove={() => explanationHandlers.removeSub(index, subIndex)}
                        removeLabel="Remove subsection"
                        editable={editable}
                        disabled={busy}
                      />
                      <TextField
                        label=""
                        value={sub.details}
                        onChangeText={(v) => explanationHandlers.updateSub(index, subIndex, 'details', v)}
                        placeholder="Subsection text"
                        multiline
                        numberOfLines={5}
                        editable={editable && !busy}
                      />
                    </View>
                  ))}
                  {editable ? (
                    <Pressable
                      style={styles.addBtn}
                      onPress={() => explanationHandlers.addSub(index)}
                      disabled={busy}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                      <Text style={styles.addBtnText}>Add subsection</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {editable ? (
                <Pressable style={styles.addBtn} onPress={explanationHandlers.add} disabled={busy}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.addBtnText}>Add section</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </CollapsibleSection>
      ) : null}

      {isDescriptiveLike ? (
        <CollapsibleSection
          title="Model answer"
          right={
            hasPreviewContent(sections) ? (
              <Pressable
                style={styles.previewToggleBtn}
                onPress={() => setPreviewModelAnswer((v) => !v)}
                hitSlop={8}
              >
                <Ionicons
                  name={previewModelAnswer ? 'create-outline' : 'eye-outline'}
                  size={15}
                  color={colors.primary}
                />
                <Text style={styles.previewToggleText}>{previewModelAnswer ? 'Edit' : 'Preview'}</Text>
              </Pressable>
            ) : undefined
          }
        >
          <ModelAnswerLinkPanel
            questionId={id}
            motherQuestionId={item.mother_question_id}
            motherQuestionLabel={item.mother_question_label}
            prototypeQuestions={item.prototype_questions}
            disabled={busy}
            onChange={() => load()}
          />
          {previewModelAnswer ? (
            <View>
              {renderSectionPreview(sections)}
              {renderProcessesPreview(sections)}
            </View>
          ) : (
            <>
              {sections.map((sec, index) => (
                <View key={index} style={styles.sectionBlock}>
                  <View style={styles.sectionBlockHeader}>
                    <Text style={styles.sectionBlockLabel}>Section {index + 1}</Text>
                    {sections.length > 1 && editable ? (
                      <Pressable onPress={() => modelAnswerHandlers.remove(index)} hitSlop={8} disabled={busy}>
                        <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                      </Pressable>
                    ) : null}
                  </View>
                  <EditableLabel
                    value={sec.title}
                    placeholder="Section heading (optional)"
                    onChange={(v) => modelAnswerHandlers.update(index, 'title', v)}
                    onRemove={() => modelAnswerHandlers.removeTitle(index)}
                    removeLabel="Clear heading"
                    editable={editable}
                    disabled={busy}
                  />
                  <TextField
                    label=""
                    value={sec.details}
                    onChangeText={(v) => modelAnswerHandlers.update(index, 'details', v)}
                    placeholder="Answer text"
                    multiline
                    numberOfLines={12}
                    style={styles.modelAnswerInput}
                    editable={editable && !busy}
                  />
                  <SectionComparisonTableBlock
                    table={sec.table}
                    editable={editable}
                    busy={busy}
                    onChange={(table) => modelAnswerHandlers.setTable(index, table)}
                    onRemove={() => modelAnswerHandlers.setTable(index, undefined)}
                    onExpand={() => {
                      if (!sec.table) modelAnswerHandlers.setTable(index, emptyComparisonTable());
                      setEditingTable({ scope: 'model', index });
                    }}
                  />
                  {sec.process ? (
                    <View style={styles.tableSummaryRow}>
                      <View style={styles.tableSummaryInfo}>
                        <Ionicons name="list-outline" size={16} color={colors.primary} />
                        <Text style={styles.tableSummaryText}>
                          Process • {(sec.process.steps ?? []).length} step
                          {(sec.process.steps ?? []).length === 1 ? '' : 's'}
                        </Text>
                      </View>
                      {editable ? (
                        <View style={styles.tableSummaryActions}>
                          <Pressable
                            onPress={() => setEditingProcess({ scope: 'model', index })}
                            hitSlop={8}
                            disabled={busy}
                          >
                            <Ionicons name="create-outline" size={20} color={colors.primary} />
                          </Pressable>
                          <Pressable
                            onPress={() => modelAnswerHandlers.setProcess(index, undefined)}
                            hitSlop={8}
                            disabled={busy}
                          >
                            <Ionicons name="trash-outline" size={20} color={colors.error} />
                          </Pressable>
                        </View>
                      ) : null}
                    </View>
                  ) : editable ? (
                    <Pressable
                      style={styles.addBtn}
                      onPress={() => {
                        modelAnswerHandlers.setProcess(index, emptyExplanationProcess());
                        setEditingProcess({ scope: 'model', index });
                      }}
                      disabled={busy}
                    >
                      <Ionicons name="list-outline" size={16} color={colors.primary} />
                      <Text style={styles.addBtnText}>Add process</Text>
                    </Pressable>
                  ) : null}
                  {sec.subsections.map((sub, subIndex) => (
                    <View key={subIndex} style={styles.subsectionEditBlock}>
                      <Text style={styles.sectionBlockLabel}>Subsection {subIndex + 1}</Text>
                      <EditableLabel
                        value={sub.subtitle}
                        placeholder="Subsection heading"
                        onChange={(v) => modelAnswerHandlers.updateSub(index, subIndex, 'subtitle', v)}
                        onRemove={() => modelAnswerHandlers.removeSub(index, subIndex)}
                        removeLabel="Remove subsection"
                        editable={editable}
                        disabled={busy}
                      />
                      <TextField
                        label=""
                        value={sub.details}
                        onChangeText={(v) => modelAnswerHandlers.updateSub(index, subIndex, 'details', v)}
                        placeholder="Subsection text"
                        multiline
                        numberOfLines={6}
                        editable={editable && !busy}
                      />
                    </View>
                  ))}
                  {editable ? (
                    <Pressable
                      style={styles.addBtn}
                      onPress={() => modelAnswerHandlers.addSub(index)}
                      disabled={busy}
                    >
                      <Ionicons name="add-circle-outline" size={16} color={colors.primary} />
                      <Text style={styles.addBtnText}>Add subsection</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}
              {editable ? (
                <Pressable style={styles.addBtn} onPress={modelAnswerHandlers.add} disabled={busy}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.addBtnText}>Add section</Text>
                </Pressable>
              ) : null}
            </>
          )}
        </CollapsibleSection>
      ) : null}

      {isUnsupportedOptions ? (
        <CollapsibleSection title="Answer">
          <Text style={styles.mutedText}>
            This question type&apos;s answer format isn&apos;t supported for mobile editing yet. Edit the
            question text above, or use the web admin for the answer.
          </Text>
        </CollapsibleSection>
      ) : null}

      {editable ? (
        <Button title={saving ? 'Saving…' : 'Save changes'} onPress={() => void handleSave()} loading={saving} disabled={busy} />
      ) : null}

      {editable ? (
        <CollapsibleSection
          title="Review status"
          right={<ReviewStatusBadge status={status} by={item.status_by_name} />}
        >
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
        </CollapsibleSection>
      ) : null}

      {canTrash ? (
        <Pressable
          style={({ pressed }) => [styles.trashBtn, (busy || pressed) && styles.trashBtnPressed]}
          onPress={handleTrash}
          disabled={busy}
        >
          <Ionicons name="trash-outline" size={18} color={colors.error} />
          <Text style={styles.trashBtnText}>{trashing ? 'Moving to trash…' : 'Move to trash'}</Text>
        </Pressable>
      ) : null}

      <Pressable style={styles.backLink} onPress={() => router.back()}>
        <Ionicons name="arrow-back" size={16} color={colors.primary} />
        <Text style={styles.backLinkText}>Back to list</Text>
      </Pressable>
    </ScrollView>

    <ComparisonTableEditorModal
      visible={editingTable !== null}
      value={editingTableValue}
      onChange={handleEditingTableChange}
      onClose={() => setEditingTable(null)}
      disabled={!editable || busy}
    />
    <ProcessEditorModal
      visible={editingProcess !== null}
      value={editingProcessValue}
      onChange={handleEditingProcessChange}
      onClose={() => setEditingProcess(null)}
      disabled={!editable || busy}
    />
    <MarkupInstructionsModal visible={showMarkupHelp} onClose={() => setShowMarkupHelp(false)} />
    </>
  );
}

const headerStyles = StyleSheet.create({
  bookChapterWrap: {
    maxWidth: 220,
    alignItems: 'center',
  },
  headerBookText: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerChapterText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 1,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  headerRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  markupGuideBtn: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  markupGuideBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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
  modelAnswerInput: {
    minHeight: 220,
    textAlignVertical: 'top',
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
  subsectionEditBlock: {
    gap: 6,
    marginLeft: spacing.md,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
  },
  tableSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    backgroundColor: colors.background,
  },
  tableEditorBlock: {
    gap: spacing.sm,
  },
  tableSummaryInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableSummaryText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  tableSummaryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  previewToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  transitionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  transitionBtn: {
    flex: 1,
  },
  trashBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: spacing.sm,
  },
  trashBtnPressed: {
    opacity: 0.6,
  },
  trashBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.error,
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

const previewStyles = StyleSheet.create({
  block: {
    gap: 4,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  heading: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
  note: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  subBlock: {
    marginTop: 6,
    marginLeft: spacing.sm,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.border,
    gap: 4,
  },
  subHeading: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
});
