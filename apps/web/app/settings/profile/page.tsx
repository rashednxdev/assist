'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Droplet, Users } from 'lucide-react';
import { BLOOD_GROUPS, type BloodGroup } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useBloodMe } from '@/lib/use-blood-me';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { WorkIdentityForm } from '@/components/org/work-identity-form';
import { DirectoryPrivacy } from '@/components/contacts/directory-privacy';
import { ServiceInfoForm } from '@/components/org/service-info-form';
import { PlaceSelect } from '@/components/blood-bank/blood-bits';

interface Profile {
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone: string;
  nid?: string;
  employee_id?: string;
  dob?: string | null;
  gender?: 'male' | 'female' | 'other' | null;
  blood_group?: BloodGroup | null;
  father_name?: string;
  mother_name?: string;
  home_district_id?: string | null;
  alternate_phone?: string;
  emergency_contact_name?: string;
  emergency_contact_relation?: string;
  emergency_contact_phone?: string;
  bio?: string;
  user_type: string;
  email_verified: boolean;
  phone_verified: boolean;
}

const EMPTY = {
  full_name_en: '',
  full_name_bn: '',
  phone: '',
  nid: '',
  employee_id: '',
  dob: '',
  gender: '',
  blood_group: '',
  father_name: '',
  mother_name: '',
  home_district_id: '',
  alternate_phone: '',
  emergency_contact_name: '',
  emergency_contact_relation: '',
  emergency_contact_phone: '',
  bio: '',
};
type Form = typeof EMPTY;

const dateInput = (v?: string | null) => (v ? v.slice(0, 10) : '');

function toForm(p: Profile): Form {
  return {
    full_name_en: p.full_name_en,
    full_name_bn: p.full_name_bn ?? '',
    phone: p.phone,
    nid: p.nid ?? '',
    employee_id: p.employee_id ?? '',
    dob: dateInput(p.dob),
    gender: p.gender ?? '',
    blood_group: p.blood_group ?? '',
    father_name: p.father_name ?? '',
    mother_name: p.mother_name ?? '',
    home_district_id: p.home_district_id ?? '',
    alternate_phone: p.alternate_phone ?? '',
    emergency_contact_name: p.emergency_contact_name ?? '',
    emergency_contact_relation: p.emergency_contact_relation ?? '',
    emergency_contact_phone: p.emergency_contact_phone ?? '',
    bio: p.bio ?? '',
  };
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4 border-t border-border pt-5 first:border-t-0 first:pt-0">
      <legend className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</legend>
      {children}
    </fieldset>
  );
}

export default function SettingsProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const { refresh: refreshBlood } = useBloodMe();

  useEffect(() => {
    apiFetch<{ data: Profile }>('/account/profile').then((r) => {
      setProfile(r.data);
      setForm(toForm(r.data));
    });
  }, []);

  const set = <K extends keyof Form>(key: K) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setMessage('');
    setBusy(true);
    try {
      const r = await apiFetch<{ data: Profile }>('/account/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name_en: form.full_name_en,
          full_name_bn: form.full_name_bn || undefined,
          phone: form.phone,
          nid: form.nid || undefined,
          employee_id: form.employee_id || undefined,
          dob: form.dob,
          gender: form.gender,
          blood_group: form.blood_group,
          father_name: form.father_name,
          mother_name: form.mother_name,
          home_district_id: form.home_district_id,
          alternate_phone: form.alternate_phone,
          emergency_contact_name: form.emergency_contact_name,
          emergency_contact_relation: form.emergency_contact_relation,
          emergency_contact_phone: form.emergency_contact_phone,
          bio: form.bio,
        }),
      });
      if ((r.data.blood_group ?? '') !== (profile?.blood_group ?? '')) void refreshBlood();
      setProfile(r.data);
      setForm(toForm(r.data));
      setMessage('Profile updated');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Profile</CardTitle>
          <p className="text-sm text-muted">Your account and basic information. Only you and administrators see personal details such as NID, parents’ names and emergency contact.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={save} className="space-y-6">
            <Section title="Account">
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant={profile.email_verified ? 'success' : 'warning'}>Email {profile.email_verified ? 'verified' : 'unverified'}</Badge>
                <Badge variant={profile.phone_verified ? 'success' : 'warning'}>Phone {profile.phone_verified ? 'verified' : 'unverified'}</Badge>
                <Badge variant="outline">{profile.user_type}</Badge>
              </div>
              <FormField label="Email" htmlFor="email">
                <Input id="email" value={profile.email} disabled />
              </FormField>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Full name (English)" htmlFor="name-en" required>
                  <Input id="name-en" value={form.full_name_en} onChange={set('full_name_en')} required />
                </FormField>
                <FormField label="Full name (Bengali)" htmlFor="name-bn">
                  <Input id="name-bn" value={form.full_name_bn} onChange={set('full_name_bn')} />
                </FormField>
                <FormField label="Mobile" htmlFor="phone" required hint="Changing it needs verification again">
                  <Input id="phone" value={form.phone} inputMode="tel" onChange={set('phone')} />
                </FormField>
                <FormField label="Alternate mobile" htmlFor="alt-phone">
                  <Input id="alt-phone" value={form.alternate_phone} inputMode="tel" maxLength={11} placeholder="01XXXXXXXXX" onChange={set('alternate_phone')} />
                </FormField>
                <FormField label="NID" htmlFor="nid" hint="Optional — for exam eligibility">
                  <Input id="nid" value={form.nid} onChange={set('nid')} />
                </FormField>
                <FormField label="Employee ID" htmlFor="emp" hint="Optional — for iBAS / office users">
                  <Input id="emp" value={form.employee_id} onChange={set('employee_id')} />
                </FormField>
              </div>
            </Section>

            <Section title="Basic information">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Date of birth" htmlFor="dob">
                  <Input id="dob" type="date" value={form.dob} max={new Date().toISOString().slice(0, 10)} onChange={set('dob')} />
                </FormField>
                <FormField label="Gender" htmlFor="gender">
                  <select id="gender" className="ibas-select" value={form.gender} onChange={set('gender')}>
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </FormField>
                <FormField label="Blood group" htmlFor="blood" hint="Opens the community blood bank">
                  <select id="blood" className="ibas-select" value={form.blood_group} onChange={set('blood_group')}>
                    <option value="">Not set</option>
                    {BLOOD_GROUPS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Father’s name" htmlFor="father">
                  <Input id="father" value={form.father_name} maxLength={120} onChange={set('father_name')} />
                </FormField>
                <FormField label="Mother’s name" htmlFor="mother">
                  <Input id="mother" value={form.mother_name} maxLength={120} onChange={set('mother_name')} />
                </FormField>
              </div>
              <PlaceSelect
                idPrefix="home"
                districtLabel="Home district"
                districtPlaceholder="Not set"
                showThana={false}
                districtId={form.home_district_id}
                thanaId=""
                onChange={(p) => setForm((f) => ({ ...f, home_district_id: p.districtId }))}
              />
            </Section>

            <Section title="Emergency contact">
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField label="Name" htmlFor="ec-name">
                  <Input id="ec-name" value={form.emergency_contact_name} maxLength={120} onChange={set('emergency_contact_name')} />
                </FormField>
                <FormField label="Relation" htmlFor="ec-rel">
                  <Input id="ec-rel" value={form.emergency_contact_relation} maxLength={60} placeholder="e.g. Spouse" onChange={set('emergency_contact_relation')} />
                </FormField>
                <FormField label="Mobile" htmlFor="ec-phone">
                  <Input id="ec-phone" value={form.emergency_contact_phone} inputMode="tel" maxLength={11} placeholder="01XXXXXXXXX" onChange={set('emergency_contact_phone')} />
                </FormField>
              </div>
            </Section>

            <Section title="About">
              <FormField label="Short bio" htmlFor="bio" hint={`${form.bio.length}/500`}>
                <textarea id="bio" className="ibas-textarea" rows={3} maxLength={500} value={form.bio} onChange={set('bio')} placeholder="Your role, experience or interests" />
              </FormField>
            </Section>

            {message && <Alert variant="success">{message}</Alert>}
            {error && <Alert variant="error">{error}</Alert>}
            <Button type="submit" disabled={busy}>
              Save profile
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Blood donor</CardTitle>
            <p className="text-sm text-muted">Choose whether to be a donor, where you can donate, and log your donations in the blood bank.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/community/blood-bank">
              <Droplet className="h-4 w-4 text-red-600" /> Open blood bank
            </Link>
          </Button>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Office &amp; designation</CardTitle>
          <p className="text-sm text-muted">
            Shown with your name in the community and the contacts directory. Required before you post a question or answer, or open contacts.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <WorkIdentityForm submitLabel="Save office & designation" />
          <DirectoryPrivacy className="border-t border-border pt-5" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Service information</CardTitle>
            <p className="text-sm text-muted">Cadre officers are grouped by BCS batch; others by joining post and date. Find your batchmates in Contacts.</p>
          </div>
          <Button asChild variant="outline">
            <Link href="/contacts?tab=batchmates">
              <Users className="h-4 w-4" /> Batchmates
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <ServiceInfoForm />
        </CardContent>
      </Card>
    </div>
  );
}
