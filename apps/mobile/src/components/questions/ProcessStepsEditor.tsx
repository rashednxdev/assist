import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextField } from '@/components/ui/TextField';
import type { ExplanationProcess, ProcessStep } from '@/types/questions';
import { colors, spacing } from '@/theme';

export function emptyExplanationProcess(): ExplanationProcess {
  return { title: '', details: '', steps: [] };
}

function emptyStep(): ProcessStep {
  return { title: '', description: '', role: '' };
}

interface ProcessStepsEditorProps {
  value: ExplanationProcess;
  onChange: (next: ExplanationProcess) => void;
  disabled?: boolean;
}

/** Mobile editor for a Process nested under a model-answer/explanation section — mirrors the web admin's process editor, laid out vertically for phone screens. */
export function ProcessStepsEditor({ value, onChange, disabled }: ProcessStepsEditorProps) {
  function patch(partial: Partial<ExplanationProcess>) {
    onChange({ ...value, ...partial });
  }

  function updateStep(index: number, stepPatch: Partial<ProcessStep>) {
    patch({ steps: value.steps.map((s, i) => (i === index ? { ...s, ...stepPatch } : s)) });
  }

  function addStep() {
    patch({ steps: [...value.steps, emptyStep()] });
  }

  function removeStep(index: number) {
    patch({ steps: value.steps.filter((_, i) => i !== index) });
  }

  function moveStep(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= value.steps.length) return;
    const steps = [...value.steps];
    [steps[index], steps[target]] = [steps[target]!, steps[index]!];
    patch({ steps });
  }

  return (
    <View style={styles.wrap}>
      <TextField
        label="Process title (optional)"
        value={value.title ?? ''}
        onChangeText={(v) => patch({ title: v })}
        placeholder="e.g. Bill submission process"
        editable={!disabled}
      />
      <TextField
        label="Process details (optional)"
        value={value.details ?? ''}
        onChangeText={(v) => patch({ details: v })}
        placeholder="Overview of this process"
        multiline
        numberOfLines={3}
        editable={!disabled}
      />

      <Text style={styles.groupLabel}>Steps</Text>
      {value.steps.map((step, i) => (
        <View key={i} style={styles.stepBlock}>
          <View style={styles.stepBlockHeader}>
            <Text style={styles.stepBlockLabel}>Step {i + 1}</Text>
            <View style={styles.stepBlockActions}>
              <Pressable onPress={() => moveStep(i, -1)} hitSlop={8} disabled={disabled || i === 0}>
                <Ionicons
                  name="chevron-up-circle-outline"
                  size={20}
                  color={i === 0 ? colors.border : colors.primary}
                />
              </Pressable>
              <Pressable
                onPress={() => moveStep(i, 1)}
                hitSlop={8}
                disabled={disabled || i === value.steps.length - 1}
              >
                <Ionicons
                  name="chevron-down-circle-outline"
                  size={20}
                  color={i === value.steps.length - 1 ? colors.border : colors.primary}
                />
              </Pressable>
              <Pressable onPress={() => removeStep(i)} hitSlop={8} disabled={disabled}>
                <Ionicons name="close-circle-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
          </View>
          <TextField
            label=""
            value={step.role ?? ''}
            onChangeText={(v) => updateStep(i, { role: v })}
            placeholder="Role (optional, e.g. DDO)"
            editable={!disabled}
          />
          <TextField
            label=""
            value={step.title}
            onChangeText={(v) => updateStep(i, { title: v })}
            placeholder="Step title *"
            editable={!disabled}
          />
          <TextField
            label=""
            value={step.description ?? ''}
            onChangeText={(v) => updateStep(i, { description: v })}
            placeholder="Step details (optional)"
            multiline
            numberOfLines={2}
            editable={!disabled}
          />
        </View>
      ))}
      <Pressable style={styles.addBtn} onPress={addStep} disabled={disabled}>
        <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
        <Text style={styles.addBtnText}>Add step</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  groupLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    marginTop: 4,
  },
  stepBlock: {
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    padding: spacing.sm,
    backgroundColor: colors.background,
  },
  stepBlockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepBlockLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  stepBlockActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
});
