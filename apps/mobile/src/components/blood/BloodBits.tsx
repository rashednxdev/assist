import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  BLOOD_GROUPS,
  type BloodGroup,
  type BloodRequestStatus,
  type BloodUrgency,
  type GeoOption,
} from '@ibas/shared-types';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { fetchDistricts, fetchThanas } from '@/lib/profile-api';
import { colors, spacing } from '@/theme';

export const RED = '#dc2626';
export const RED_DARK = '#991b1b';
export const RED_SOFT = '#fef2f2';
export const RED_BORDER = '#fecaca';

const DROP_SIZE = { sm: 32, md: 44, lg: 56, xl: 76 } as const;

/** Blood group in a drop-shaped badge. */
export function BloodDrop({
  group,
  size = 'md',
  inverted,
}: {
  group: BloodGroup | string | null;
  size?: keyof typeof DROP_SIZE;
  inverted?: boolean;
}) {
  const d = DROP_SIZE[size];
  return (
    <View
      style={[
        styles.drop,
        {
          width: d,
          height: d,
          borderRadius: d / 2,
          borderTopLeftRadius: d * 0.12,
          backgroundColor: inverted ? colors.white : group ? RED : '#94a3b8',
        },
      ]}
    >
      <Text style={[styles.dropText, { fontSize: d * 0.32, color: inverted ? RED : colors.white }]}>{group ?? '?'}</Text>
    </View>
  );
}

export function GroupPicker({
  value,
  onChange,
  disabled,
}: {
  value: BloodGroup | '' | null;
  onChange: (g: BloodGroup) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.groupGrid} accessibilityRole="radiogroup" accessibilityLabel="Blood group">
      {BLOOD_GROUPS.map((g) => {
        const on = value === g;
        return (
          <Pressable
            key={g}
            disabled={disabled}
            onPress={() => onChange(g)}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            style={({ pressed }) => [styles.groupBtn, on && styles.groupBtnOn, pressed && styles.pressed, disabled && styles.disabled]}
          >
            <Text style={[styles.groupText, on && styles.groupTextOn]}>{g}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function Pill({
  text,
  bg,
  fg,
  icon,
  style,
}: {
  text: string;
  bg: string;
  fg: string;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }, style]}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={[styles.pillText, { color: fg }]}>{text}</Text>
    </View>
  );
}

export function EligibilityBadge({ eligible, days, available = true }: { eligible: boolean; days: number; available?: boolean }) {
  if (!available) return <Pill text="Not available now" bg="#f1f5f9" fg="#475569" icon="pause-circle" />;
  if (eligible) return <Pill text="Eligible now" bg="#ecfdf5" fg="#047857" icon="checkmark-circle" />;
  return <Pill text={`Eligible in ${days} day${days === 1 ? '' : 's'}`} bg="#fffbeb" fg="#b45309" icon="time" />;
}

export const URGENCY_STYLE: Record<BloodUrgency, { label: string; bg: string; fg: string }> = {
  critical: { label: 'Critical', bg: RED, fg: colors.white },
  urgent: { label: 'Urgent', bg: '#f59e0b', fg: colors.white },
  normal: { label: 'Normal', bg: '#f1f5f9', fg: '#334155' },
};

export function UrgencyBadge({ urgency }: { urgency: BloodUrgency }) {
  const u = URGENCY_STYLE[urgency];
  return <Pill text={u.label} bg={u.bg} fg={u.fg} />;
}

const STATUS_STYLE: Record<BloodRequestStatus, { bg: string; fg: string }> = {
  open: { bg: '#ecfdf5', fg: '#047857' },
  fulfilled: { bg: '#f0f9ff', fg: '#0369a1' },
  cancelled: { bg: '#f1f5f9', fg: '#475569' },
  expired: { bg: '#f1f5f9', fg: '#475569' },
};

export function StatusBadge({ status }: { status: BloodRequestStatus }) {
  const s = STATUS_STYLE[status];
  return <Pill text={status[0]!.toUpperCase() + status.slice(1)} bg={s.bg} fg={s.fg} />;
}

export function Tag({ text, tone }: { text: string; tone: 'dark' | 'red' | 'green' }) {
  const t = { dark: ['#0f172a', colors.white], red: [RED_SOFT, '#b91c1c'], green: ['#ecfdf5', '#047857'] }[tone];
  return <Pill text={text} bg={t[0]!} fg={t[1]!} />;
}

export interface Place {
  districtId: string;
  thanaId: string;
}

/** District + thana pickers backed by the blood bank's public place lists. */
export function PlaceFields({
  value,
  onChange,
  requireDistrict,
  districtLabel = 'District',
  showThana = true,
  initialNames,
}: {
  value: Place;
  onChange: (p: Place) => void;
  requireDistrict?: boolean;
  districtLabel?: string;
  showThana?: boolean;
  /** Names for the initial ids so they show before the lists load. */
  initialNames?: { district?: string; thana?: string };
}) {
  const [districts, setDistricts] = useState<GeoOption[]>([]);
  const [thanas, setThanas] = useState<GeoOption[]>([]);
  const [open, setOpen] = useState<'district' | 'thana' | null>(null);

  useEffect(() => {
    fetchDistricts()
      .then(setDistricts)
      .catch(() => setDistricts([]));
  }, []);

  useEffect(() => {
    if (!showThana || !value.districtId) {
      setThanas([]);
      return;
    }
    let live = true;
    fetchThanas(value.districtId)
      .then((t) => live && setThanas(t))
      .catch(() => live && setThanas([]));
    return () => {
      live = false;
    };
  }, [value.districtId, showThana]);

  const districtName = useMemo(
    () => districts.find((d) => d.id === value.districtId)?.name ?? (value.districtId ? initialNames?.district ?? '' : ''),
    [districts, value.districtId, initialNames?.district],
  );
  const thanaName = useMemo(
    () => thanas.find((t) => t.id === value.thanaId)?.name ?? (value.thanaId ? initialNames?.thana ?? '' : ''),
    [thanas, value.thanaId, initialNames?.thana],
  );

  return (
    <View style={styles.placeWrap}>
      <SelectField
        label={districtLabel}
        required={requireDistrict}
        display={districtName}
        placeholder={requireDistrict ? 'Select district' : 'Any district'}
        onPress={() => setOpen('district')}
      />
      {showThana ? (
        <SelectField
          label="Thana / upazila"
          display={thanaName}
          placeholder={value.districtId ? 'Any thana' : 'Choose a district first'}
          disabled={!value.districtId}
          onPress={() => setOpen('thana')}
        />
      ) : null}
      <PickerSheet
        visible={open === 'district'}
        title={districtLabel}
        options={districts.map((d) => ({ value: d.id, label: d.name, hint: d.name_bn }))}
        value={value.districtId}
        searchable
        searchPlaceholder="Search district"
        clearLabel={requireDistrict ? undefined : 'Any district'}
        onSelect={(o) => onChange({ districtId: o.value, thanaId: '' })}
        onClose={() => setOpen(null)}
      />
      <PickerSheet
        visible={open === 'thana'}
        title="Thana / upazila"
        options={thanas.map((t) => ({ value: t.id, label: t.name, hint: t.name_bn }))}
        value={value.thanaId}
        searchable
        searchPlaceholder="Search thana"
        clearLabel="Any thana"
        emptyText="No thanas for this district."
        onSelect={(o) => onChange({ districtId: value.districtId, thanaId: o.value })}
        onClose={() => setOpen(null)}
      />
    </View>
  );
}

export function ErrorNote({ text }: { text: string }) {
  if (!text) return null;
  return (
    <View style={styles.error}>
      <Ionicons name="alert-circle" size={16} color={colors.error} />
      <Text style={styles.errorText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  disabled: {
    opacity: 0.55,
  },
  drop: {
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '45deg' }],
  },
  dropText: {
    fontWeight: '900',
    transform: [{ rotate: '-45deg' }],
  },
  groupGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  groupBtn: {
    width: '22.5%',
    flexGrow: 1,
    alignItems: 'center',
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  groupBtnOn: {
    borderColor: RED,
    backgroundColor: RED,
  },
  groupText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#b91c1c',
  },
  groupTextOn: {
    color: colors.white,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  placeWrap: {
    gap: spacing.md,
  },
  error: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.sm + 4,
    borderRadius: 12,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: RED_BORDER,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#991b1b',
  },
});
