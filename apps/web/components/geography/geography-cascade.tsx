'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { FormField } from '@/components/shared/form-field';
import { cn } from '@/lib/utils';

interface GeoItem {
  _id: string;
  name_en: string;
  name_bn?: string;
}

interface Props {
  divisionId: string;
  districtId: string;
  thanaId: string;
  onDivisionChange: (id: string) => void;
  onDistrictChange: (id: string) => void;
  onThanaChange: (id: string) => void;
  className?: string;
}

export function GeographyCascade({
  divisionId,
  districtId,
  thanaId,
  onDivisionChange,
  onDistrictChange,
  onThanaChange,
  className,
}: Props) {
  const [divisions, setDivisions] = useState<GeoItem[]>([]);
  const [districts, setDistricts] = useState<GeoItem[]>([]);
  const [thanas, setThanas] = useState<GeoItem[]>([]);

  useEffect(() => {
    apiFetch<{ data: GeoItem[] }>('/setup/divisions').then((r) => setDivisions(r.data));
  }, []);

  useEffect(() => {
    if (!divisionId) {
      setDistricts([]);
      return;
    }
    apiFetch<{ data: GeoItem[] }>(`/setup/divisions/${divisionId}/districts`).then((r) =>
      setDistricts(r.data),
    );
  }, [divisionId]);

  useEffect(() => {
    if (!districtId) {
      setThanas([]);
      return;
    }
    apiFetch<{ data: GeoItem[] }>(`/setup/districts/${districtId}/thanas`).then((r) => setThanas(r.data));
  }, [districtId]);

  return (
    <div className={cn('grid gap-4 sm:grid-cols-3', className)}>
      <FormField label="Division" required>
        <select
          className="ibas-select"
          value={divisionId}
          onChange={(e) => {
            onDivisionChange(e.target.value);
            onDistrictChange('');
            onThanaChange('');
          }}
        >
          <option value="">Select division</option>
          {divisions.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name_en}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="District" required>
        <select
          className="ibas-select"
          value={districtId}
          disabled={!divisionId}
          onChange={(e) => {
            onDistrictChange(e.target.value);
            onThanaChange('');
          }}
        >
          <option value="">Select district</option>
          {districts.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name_en}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Thana" required>
        <select
          className="ibas-select"
          value={thanaId}
          disabled={!districtId}
          onChange={(e) => onThanaChange(e.target.value)}
        >
          <option value="">Select thana</option>
          {thanas.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name_en}
            </option>
          ))}
        </select>
      </FormField>
    </div>
  );
}
