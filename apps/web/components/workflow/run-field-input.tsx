'use client';

import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';

interface RunField {
  name: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  options?: string[];
}

export function RunFieldInput({
  field,
  value,
  onChange,
  disabled,
}: {
  field: RunField;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const inputType =
    field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'otp' ? 'text' : 'text';

  if (field.type === 'select' && field.options?.length) {
    return (
      <FormField label={field.label} required={field.required}>
        <select
          className="ibas-select"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {field.options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      </FormField>
    );
  }

  return (
    <FormField label={field.label} required={field.required}>
      <Input
        type={inputType}
        value={value}
        disabled={disabled}
        placeholder={field.placeholder ?? (field.type === 'otp' ? 'Enter OTP' : undefined)}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}
