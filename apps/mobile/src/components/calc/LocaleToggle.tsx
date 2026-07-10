import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors } from '@/theme';
import type { CalcLocale } from '@/lib/calc-i18n';

export function LocaleToggle({
  value,
  onChange,
}: {
  value: CalcLocale;
  onChange: (v: CalcLocale) => void;
}) {
  return (
    <View style={styles.wrap}>
      {(['en', 'bn'] as const).map((loc) => {
        const active = value === loc;
        return (
          <Pressable
            key={loc}
            onPress={() => onChange(loc)}
            style={[styles.btn, active && styles.btnActive]}
          >
            <Text style={[styles.text, active && styles.textActive]}>
              {loc === 'en' ? 'EN' : 'বাং'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 2,
  },
  btn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  btnActive: {
    backgroundColor: colors.primary,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
  },
  textActive: {
    color: colors.white,
  },
});
