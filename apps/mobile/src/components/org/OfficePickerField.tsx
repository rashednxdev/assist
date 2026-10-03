import { useCallback, useState } from 'react';
import type { OfficeOption } from '@ibas/shared-types';
import { PickerSheet, SelectField } from '@/components/ui/PickerSheet';
import { officeLabel, searchOffices } from '@/lib/org-api';

/** Searchable office picker; matches office names, short names, codes and parent offices. */
export function OfficePickerField({
  label = 'Office',
  value,
  onChange,
  error,
  required,
  placeholder = 'Search your office',
  clearLabel,
  departmentId,
  topLevel,
  disabled,
  title = 'Choose office',
}: {
  label?: string;
  value: OfficeOption | null;
  onChange: (o: OfficeOption | null) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  /** Offer a first row that clears the choice. */
  clearLabel?: string;
  /** Only offices in this department (the top-level office and everything under it). */
  departmentId?: string;
  /** Only top-level offices (departments). */
  topLevel?: boolean;
  disabled?: boolean;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OfficeOption[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    (q: string) => {
      setLoading(true);
      searchOffices(q, { departmentId, topLevel })
        .then(setOptions)
        .catch(() => setOptions([]))
        .finally(() => setLoading(false));
    },
    [departmentId, topLevel],
  );

  return (
    <>
      <SelectField
        label={label}
        required={required}
        display={value ? officeLabel(value) : ''}
        placeholder={placeholder}
        hint={value?.parent_path || undefined}
        error={error}
        icon="business-outline"
        onPress={() => !disabled && setOpen(true)}
      />
      <PickerSheet
        visible={open}
        title={title}
        value={value?.id}
        options={options.map((o) => ({
          value: o.id,
          label: officeLabel(o),
          badge: o.type_short,
          hint: [o.parent_path || 'Top-level office', o.office_code].filter(Boolean).join(' · '),
        }))}
        onSearch={search}
        loading={loading}
        searchPlaceholder="Office name, short name or code"
        emptyText="No office found. Ask an admin to add it."
        clearLabel={clearLabel}
        onSelect={(opt) => {
          if (!opt.value) return onChange(null);
          const o = options.find((x) => x.id === opt.value);
          if (o) onChange(o);
        }}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
