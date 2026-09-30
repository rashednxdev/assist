'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { Label } from '@/components/ui/label';

export interface GeoTree {
  _id: string;
  name_en: string;
  districts: Array<{ _id: string; name_en: string; thanas: Array<{ _id: string; name_en: string }> }>;
}

export interface LocationValue {
  division_id: string;
  district_id: string;
  thana_id: string;
}

export const EMPTY_LOCATION: LocationValue = { division_id: '', district_id: '', thana_id: '' };

let geoCache: Promise<GeoTree[]> | null = null;

export function useGeoTree(): GeoTree[] {
  const [geo, setGeo] = useState<GeoTree[]>([]);
  useEffect(() => {
    let live = true;
    geoCache ??= apiFetch<{ data: GeoTree[] }>('/setup/geography/tree')
      .then((r) => r.data)
      .catch((err) => {
        geoCache = null;
        throw err;
      });
    geoCache.then((g) => live && setGeo(g)).catch(() => live && setGeo([]));
    return () => {
      live = false;
    };
  }, []);
  return geo;
}

/** Division of a district, for records saved before division was stored. */
export function divisionOfDistrict(geo: GeoTree[], districtId: string): string {
  return geo.find((d) => d.districts.some((x) => x._id === districtId))?._id ?? '';
}

export function locationLabel(geo: GeoTree[], v: LocationValue): string {
  const div = geo.find((d) => d._id === v.division_id);
  const dist = div?.districts.find((d) => d._id === v.district_id);
  const thana = dist?.thanas.find((t) => t._id === v.thana_id);
  return [thana?.name_en, dist?.name_en, div?.name_en].filter(Boolean).join(', ');
}

/** Division → District → Upazila; changing a level clears the ones below it. */
export function LocationSelects({
  geo,
  value,
  onChange,
  idPrefix,
  emptyLabel = 'Not set',
  area = false,
  className = 'grid gap-3 sm:grid-cols-3',
}: {
  geo: GeoTree[];
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  idPrefix: string;
  emptyLabel?: string;
  /** Blank lower levels mean "the whole area above" rather than "not set". */
  area?: boolean;
  className?: string;
}) {
  const division = geo.find((d) => d._id === value.division_id);
  const districts = division?.districts ?? [];
  const thanas = districts.find((d) => d._id === value.district_id)?.thanas ?? [];
  return (
    <div className={className}>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-division`}>Division</Label>
        <select
          id={`${idPrefix}-division`}
          className="ibas-select"
          value={value.division_id}
          onChange={(e) => onChange({ division_id: e.target.value, district_id: '', thana_id: '' })}
        >
          <option value="">{emptyLabel}</option>
          {geo.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name_en}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-district`}>District</Label>
        <select
          id={`${idPrefix}-district`}
          className="ibas-select"
          value={value.district_id}
          disabled={!value.division_id}
          onChange={(e) => onChange({ ...value, district_id: e.target.value, thana_id: '' })}
        >
          <option value="">{area && value.division_id ? 'All districts' : emptyLabel}</option>
          {districts.map((d) => (
            <option key={d._id} value={d._id}>
              {d.name_en}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-thana`}>Upazila / Thana</Label>
        <select
          id={`${idPrefix}-thana`}
          className="ibas-select"
          value={value.thana_id}
          disabled={!value.district_id}
          onChange={(e) => onChange({ ...value, thana_id: e.target.value })}
        >
          <option value="">{area && value.district_id ? 'All upazilas' : emptyLabel}</option>
          {thanas.map((t) => (
            <option key={t._id} value={t._id}>
              {t.name_en}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
