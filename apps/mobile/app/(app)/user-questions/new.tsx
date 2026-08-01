import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Modal,
  Alert,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchExamPrograms, fetchExamTree } from '@/lib/exams-api';
import { submitUserQuestion } from '@/lib/user-questions-api';
import type { ExamProgramItem, ExamSubject } from '@/types/exams';
import { colors, spacing } from '@/theme';

export default function SubmitUserQuestionScreen() {
  const router = useRouter();

  const [exams, setExams] = useState<ExamProgramItem[]>([]);
  const [examPickerOpen, setExamPickerOpen] = useState(false);
  const [selectedExam, setSelectedExam] = useState<ExamProgramItem | null>(null);

  const [subjects, setSubjects] = useState<ExamSubject[]>([]);
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState<ExamSubject | null>(null);
  const [loadingSubjects, setLoadingSubjects] = useState(false);

  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchExamPrograms()
      .then(setExams)
      .catch(() => setExams([]));
  }, []);

  function pickExam(exam: ExamProgramItem) {
    setSelectedExam(exam);
    setSelectedSubject(null);
    setSubjects([]);
    setExamPickerOpen(false);
  }

  async function openSubjectPicker() {
    if (!selectedExam) return;
    setLoadingSubjects(true);
    try {
      const tree = await fetchExamTree(selectedExam.id);
      setSubjects(tree.parts.flatMap((p) => p.subjects));
      setSubjectPickerOpen(true);
    } catch {
      Alert.alert('Could not load subjects', 'Check your connection and try again.');
    } finally {
      setLoadingSubjects(false);
    }
  }

  async function doSubmit() {
    if (!selectedSubject) return;
    setSubmitting(true);
    setError('');
    try {
      await submitUserQuestion(selectedSubject.id, body.trim());
      Alert.alert('Submitted', 'Your question has been submitted for review.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmitTap() {
    setError('');
    if (!selectedSubject) {
      setError('Select a subject first');
      return;
    }
    if (body.trim().length < 5) {
      setError('Please write a more complete question');
      return;
    }
    Alert.alert(
      'Confirm new question',
      "This is a new question — I didn't find this question already listed under this subject.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Submit', onPress: () => void doSubmit() },
      ],
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.hint}>
        Submit a question you couldn&apos;t find under a subject. An admin will review it — if
        accepted, they&apos;ll link a real question with the answer, and you can view it from
        &quot;My Submitted Questions&quot;. Up to 10 submissions per subject.
      </Text>

      <Text style={styles.label}>Exam</Text>
      <Pressable style={styles.selectBtn} onPress={() => setExamPickerOpen(true)}>
        <Text style={selectedExam ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
          {selectedExam?.name ?? 'Select exam'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Text style={styles.label}>Subject</Text>
      <Pressable
        style={[styles.selectBtn, !selectedExam && styles.selectBtnDisabled]}
        disabled={!selectedExam || loadingSubjects}
        onPress={() => void openSubjectPicker()}
      >
        <Text style={selectedSubject ? styles.selectText : styles.selectPlaceholder} numberOfLines={1}>
          {loadingSubjects
            ? 'Loading...'
            : (selectedSubject?.name ?? (selectedExam ? 'Select subject' : 'Select an exam first'))}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </Pressable>

      <Text style={styles.label}>Your question</Text>
      <TextInput
        style={styles.textArea}
        value={body}
        onChangeText={setBody}
        placeholder="Write your question here..."
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={6}
        textAlignVertical="top"
      />

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable
        style={({ pressed }) => [
          styles.submitBtn,
          pressed && styles.submitBtnPressed,
          submitting && styles.submitBtnDisabled,
        ]}
        disabled={submitting}
        onPress={handleSubmitTap}
      >
        <Text style={styles.submitBtnText}>{submitting ? 'Submitting...' : 'Submit question'}</Text>
      </Pressable>

      <Modal
        visible={examPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setExamPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTouch} onPress={() => setExamPickerOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select exam</Text>
            <FlatList
              data={exams}
              keyExtractor={(e) => e.id}
              style={styles.modalList}
              renderItem={({ item }) => (
                <Pressable style={styles.modalRow} onPress={() => pickExam(item)}>
                  <Text style={styles.modalRowText}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.modalEmpty}>No exams found.</Text>}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={subjectPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setSubjectPickerOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable style={styles.modalBackdropTouch} onPress={() => setSubjectPickerOpen(false)} />
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Select subject</Text>
            <FlatList
              data={subjects}
              keyExtractor={(s) => s.id}
              style={styles.modalList}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.modalRow}
                  onPress={() => {
                    setSelectedSubject(item);
                    setSubjectPickerOpen(false);
                  }}
                >
                  <Text style={styles.modalRowText}>{item.name}</Text>
                </Pressable>
              )}
              ListEmptyComponent={<Text style={styles.modalEmpty}>No subjects found.</Text>}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: spacing.lg,
    gap: spacing.sm,
    paddingBottom: spacing.xl,
  },
  hint: {
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  selectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  selectBtnDisabled: {
    opacity: 0.5,
  },
  selectText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: colors.textMuted,
  },
  textArea: {
    minHeight: 130,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    backgroundColor: colors.surface,
    padding: spacing.md,
    fontSize: 14,
    color: colors.text,
  },
  errorText: {
    fontSize: 13,
    color: colors.error,
    fontWeight: '600',
  },
  submitBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 14,
  },
  submitBtnPressed: {
    opacity: 0.9,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'flex-end',
  },
  modalBackdropTouch: {
    flex: 1,
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.lg,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  modalList: {
    flexGrow: 0,
  },
  modalRow: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalRowText: {
    fontSize: 15,
    color: colors.text,
  },
  modalEmpty: {
    fontSize: 14,
    color: colors.textMuted,
    paddingVertical: spacing.md,
    textAlign: 'center',
  },
});
