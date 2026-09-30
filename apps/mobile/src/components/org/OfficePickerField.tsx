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
}: {
  label?: string;
  value: OfficeOption | null;
  onChange: (o: OfficeOption | null) => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
  /** Offer a first row that clears the choice. */
  clearLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OfficeOption[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback((q: string) => {
    setLoading(true);
    searchOffices(q)
      .then(setOptions)
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, []);

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
        onPress={() => setOpen(true)}
      />
      <PickerSheet
        visible={open}
        title="Choose office"
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
