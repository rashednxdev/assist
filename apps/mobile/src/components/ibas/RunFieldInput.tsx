import { useState } from 'react';
import { DateField } from '@/components/ui/DateField';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { TextField } from '@/components/ui/TextField';
import type { RunField } from '@/lib/ibas-api';

export function RunFieldInput({ field, value, onChange, disabled }: { field: RunField; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const [picking, setPicking] = useState(false);
  const label = field.required ? `${field.label} *` : field.label;

  if (field.type === 'select' && field.options?.length) {
    return (
      <>
        <SelectField label={field.label} required={field.required} display={value} placeholder="Select…" hint={field.hint} disabled={disabled} onPress={() => setPicking(true)} />
        <PickerSheet
          visible={picking}
          title={field.label}
          options={field.options.map((o) => ({ value: o, label: o }))}
          value={value}
          searchable={field.options.length > 8}
          onSelect={(o) => onChange(o.value)}
          onClose={() => setPicking(false)}
        />
      </>
    );
  }

  if (field.type === 'date' && !disabled) return <DateField label={label} value={value} onChange={onChange} />;

  return (
    <TextField
      label={label}
      hint={field.hint ?? (field.type === 'file' ? 'Enter the file / document reference' : undefined)}
      value={value}
      onChangeText={onChange}
      editable={!disabled}
      placeholder={field.placeholder ?? (field.type === 'otp' ? 'Enter OTP' : undefined)}
      autoCapitalize="sentences"
      keyboardType={field.type === 'number' ? 'decimal-pad' : field.type === 'otp' ? 'number-pad' : 'default'}
    />
  );
}
