import { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  type TextInputProps,
  type NativeSyntheticEvent,
  type TextInputFocusEventData,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKeyboardScroll } from '@/lib/keyboard-scroll';
import { colors, spacing } from '@/theme';

interface TextFieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
  secureToggle?: boolean;
  variant?: 'default' | 'premium';
}

export function TextField({
  label,
  hint,
  error,
  secureToggle,
  secureTextEntry,
  variant = 'default',
  style,
  onFocus,
  ...rest
}: TextFieldProps) {
  const [hidden, setHidden] = useState(!!secureTextEntry);
  const premium = variant === 'premium';
  const wrapRef = useRef<View>(null);
  const keyboardScroll = useKeyboardScroll();

  function handleFocus(e: NativeSyntheticEvent<TextInputFocusEventData>) {
    onFocus?.(e);
    // Defer so the keyboard event + content padding can settle first.
    requestAnimationFrame(() => {
      keyboardScroll?.ensureVisible(wrapRef.current);
    });
  }

  return (
    <View ref={wrapRef} style={styles.wrap} collapsable={false}>
      <Text style={[styles.label, premium && styles.labelPremium]}>{label}</Text>
      <View
        style={[
          styles.inputRow,
          premium && styles.inputRowPremium,
          error ? styles.inputError : null,
        ]}
      >
        <TextInput
          style={[styles.input, premium && styles.inputPremium, style]}
          placeholderTextColor={premium ? 'rgba(255,255,255,0.35)' : colors.textMuted}
          secureTextEntry={secureToggle ? hidden : secureTextEntry}
          autoCapitalize="none"
          onFocus={handleFocus}
          {...rest}
        />
        {secureToggle && (
          <Pressable onPress={() => setHidden((v) => !v)} hitSlop={8}>
            <Ionicons
              name={hidden ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={premium ? 'rgba(255,255,255,0.55)' : colors.textMuted}
            />
          </Pressable>
        )}
      </View>
      {hint && !error ? <Text style={[styles.hint, premium && styles.hintPremium]}>{hint}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.xs,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  labelPremium: {
    color: 'rgba(255,255,255,0.88)',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    minHeight: 48,
  },
  inputRowPremium: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(212, 175, 55, 0.22)',
  },
  inputError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    paddingVertical: spacing.sm,
  },
  inputPremium: {
    color: colors.white,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
  },
  hintPremium: {
    color: 'rgba(255,255,255,0.45)',
  },
  error: {
    fontSize: 12,
    color: colors.error,
  },
});
