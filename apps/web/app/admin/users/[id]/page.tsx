'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { USER_STATUSES, USER_TYPES } from '@ibas/shared-constants';
import { apiFetch } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/shared/page-header';
import { Alert } from '@/components/ui/alert';
import { GeographyCascade } from '@/components/geography/geography-cascade';

type Tab = 'profile' | 'roles' | 'access' | 'addresses' | 'activity';

interface UserDetail {
  id: string;
  full_name_en: string;
  full_name_bn?: string;
  email: string;
  phone: string;
  user_type: string;
  status: string;
  is_verified: boolean;
  is_super_admin: boolean;
  allow_multi_device?: boolean;
  bound_device_id?: string | null;
  bound_device_at?: string | null;
  bound_device_label?: string | null;
  amount_received?: number;
  all_exam_subjects?: boolean;
  exam_subject_ids?: string[];
  exam_subjects?: Array<{ id: string; name: string; name_bn?: string }>;
  workflow_roles: Array<{ role_code: string; is_active: boolean; role_id: string }>;
}

interface ExamSubjectOption {
  id: string;
  name: string;
  name_bn?: string;
  label: string;
  exam_name?: string;
}

interface RoleItem {
  _id: string;
  code: string;
  name_en: string;
  color: string;
}

interface ModuleItem {
  _id: string;
  code: string;
  name_en: string;
}

interface ModuleAccess {
  id: string;
  module_id: string;
  module_code: string;
  can_read: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_grade: boolean;
  can_publish: boolean;
  bypass_stop?: boolean;
}

interface AddressItem {
  id: string;
  address_type: string;
  division_id: string;
  district_id: string;
  thana_id: string;
  full_address?: string;
  is_primary: boolean;
}

interface ActivityItem {
  id: string;
  action: string;
  description?: string;
  created_at: string;
}

/** Mirrors LEARNING_MODULE_CODES in apps/mobile/src/lib/api.ts — the modules that actually gate
 * mobile app screens, grouped first so an admin granting a regular user mobile access doesn't
 * have to scan past office/admin-only modules to find them. */
const MOBILE_MODULE_CODES = [
  'BOOKS',
  'QUESTIONS',
  'EXAM',
  'PAPER',
  'OCR',
  'PENSION',
  'QUESTION_EDIT',
  'QOTD',
  'EXAM_ROUTINE',
  'EXAM_WEEK',
  'USER_QUESTIONS',
  'USER',
];

const tabs: { id: Tab; label: string }[] = [
  { id: 'profile', label: 'Profile' },
  { id: 'roles', label: 'Workflow roles' },
  { id: 'access', label: 'Module access' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'activity', label: 'Activity' },
];

export default function EditUserPage() {
  const params = useParams();
  const userId = params.id as string;

  const [tab, setTab] = useState<Tab>('profile');
  const [user, setUser] = useState<UserDetail | null>(null);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [modules, setModules] = useState<ModuleItem[]>([]);
  const [moduleAccess, setModuleAccess] = useState<ModuleAccess[]>([]);
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [selectedRole, setSelectedRole] = useState('');
  const [accessDraft, setAccessDraft] = useState<Record<string, Partial<ModuleAccess>>>({});
  const [subjectOptions, setSubjectOptions] = useState<ExamSubjectOption[]>([]);

  const [addrForm, setAddrForm] = useState({
    address_type: 'present' as 'permanent' | 'present' | 'office',
    division_id: '',
    district_id: '',
    thana_id: '',
    full_address: '',
    is_primary: false,
  });

  const loadUser = useCallback(async () => {
    const res = await apiFetch<{ data: UserDetail }>(`/users/${userId}`);
    setUser(res.data);
  }, [userId]);

  useEffect(() => {
    Promise.all([
      loadUser(),
      apiFetch<{ data: RoleItem[] }>('/setup/roles').then((r) => setRoles(r.data)),
      apiFetch<{ data: ModuleItem[] }>('/setup/modules?all=true').then((r) => setModules(r.data)),
      apiFetch<{ data: ExamSubjectOption[] }>('/users/exam-subject-options')
        .then((r) => setSubjectOptions(r.data))
        .catch(() => setSubjectOptions([])),
    ])
      .catch(() => setError('Failed to load user'))
      .finally(() => setLoading(false));
  }, [loadUser]);

  useEffect(() => {
    if (tab === 'access') {
      apiFetch<{ data: ModuleAccess[] }>(`/users/${userId}/module-access`).then((r) =>
        setModuleAccess(r.data),
      );
    }
    if (tab === 'addresses') {
      apiFetch<{ data: AddressItem[] }>(`/users/${userId}/addresses`).then((r) => setAddresses(r.data));
    }
    if (tab === 'activity') {
      apiFetch<{ data: ActivityItem[] }>(`/users/${userId}/activity`).then((r) => setActivity(r.data));
    }
  }, [tab, userId]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setError('');
    try {
      await apiFetch(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          full_name_en: user.full_name_en,
          full_name_bn: user.full_name_bn || undefined,
          email: user.email,
          phone: user.phone,
          user_type: user.user_type,
          status: user.status,
          is_verified: user.is_verified,
          is_super_admin: user.is_super_admin,
          allow_multi_device: user.allow_multi_device ?? false,
          amount_received: Number(user.amount_received ?? 0),
          all_exam_subjects: user.all_exam_subjects !== false,
          exam_subject_ids:
            user.all_exam_subjects === false ? (user.exam_subject_ids ?? []) : [],
        }),
      });
      setMessage('Profile saved');
      await loadUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  }

  async function clearBoundDevice() {
    if (!user) return;
    setError('');
    try {
      await apiFetch(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ clear_bound_device: true }),
      });
      setMessage('Bound device cleared — user can bind a new device on next login');
      await loadUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear device');
    }
  }

  async function forceLogout() {
    if (!user) return;
    setError('');
    try {
      await apiFetch(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ force_logout: true }),
      });
      setMessage('User sessions invalidated — they will be signed out on the next request');
      await loadUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to force logout');
    }
  }

  async function assignRole() {
    if (!selectedRole) return;
    try {
      const res = await apiFetch<{ data: UserDetail }>(`/users/${userId}/workflow-roles`, {
        method: 'POST',
        body: JSON.stringify({ role_code: selectedRole }),
      });
      setUser(res.data);
      setSelectedRole('');
      setMessage('Role assigned');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign role');
    }
  }

  async function removeRole(code: string) {
    try {
      const res = await apiFetch<{ data: UserDetail }>(`/users/${userId}/workflow-roles/${code}`, {
        method: 'DELETE',
      });
      setUser(res.data);
      setMessage('Role removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove role');
    }
  }

  async function saveModuleAccess(moduleId: string) {
    const draft = accessDraft[moduleId] ?? {
      can_read: true,
      can_create: false,
      can_update: false,
      can_delete: false,
      can_grade: false,
      can_publish: false,
      bypass_stop: false,
    };
    try {
      await apiFetch(`/users/${userId}/module-access`, {
        method: 'POST',
        body: JSON.stringify({ module_id: moduleId, ...draft }),
      });
      const res = await apiFetch<{ data: ModuleAccess[] }>(`/users/${userId}/module-access`);
      setModuleAccess(res.data);
      setMessage('Module access saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save access');
    }
  }

  async function revokeAccess(moduleId: string) {
    try {
      await apiFetch(`/users/${userId}/module-access/${moduleId}`, { method: 'DELETE' });
      setModuleAccess((prev) => prev.filter((a) => a.module_id !== moduleId));
      setMessage('Access revoked');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke');
    }
  }

  async function addAddress(e: React.FormEvent) {
    e.preventDefault();
    try {
      await apiFetch(`/users/${userId}/addresses`, {
        method: 'POST',
        body: JSON.stringify(addrForm),
      });
      const res = await apiFetch<{ data: AddressItem[] }>(`/users/${userId}/addresses`);
      setAddresses(res.data);
      setAddrForm({
        address_type: 'present',
        division_id: '',
        district_id: '',
        thana_id: '',
        full_address: '',
        is_primary: false,
      });
      setMessage('Address added');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add address');
    }
  }

  if (loading || !user) {
    return <p className="text-muted">Loading...</p>;
  }

  const activeRoles = user.workflow_roles.filter((r) => r.is_active);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={user.full_name_en}
        description={user.email}
        backHref="/admin/users"
        backLabel="Users"
      />

      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="ibas-tabs">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => {
              setTab(t.id);
              setMessage('');
              setError('');
            }}
            className={`ibas-tab ${tab === t.id ? 'ibas-tab-active' : ''}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={saveProfile} className="space-y-4">
              <div className="space-y-2">
                <Label>Full name (English)</Label>
                <Input
                  value={user.full_name_en}
                  onChange={(e) => setUser({ ...user, full_name_en: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Full name (Bengali)</Label>
                <Input
                  value={user.full_name_bn ?? ''}
                  onChange={(e) => setUser({ ...user, full_name_bn: e.target.value })}
                  placeholder="Optional"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={user.email}
                    onChange={(e) => setUser({ ...user, email: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={user.phone}
                    onChange={(e) => setUser({ ...user, phone: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Amount received</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={user.amount_received ?? 0}
                  onChange={(e) =>
                    setUser({
                      ...user,
                      amount_received: e.target.value === '' ? 0 : Number(e.target.value),
                    })
                  }
                />
                <p className="text-xs text-muted">
                  0 = unpaid — mobile shows &quot;Pay to Get Access Module&quot; for paid modules.
                </p>
              </div>
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Exam subject access</p>
                <p className="text-xs text-muted">
                  Limits Exam Papers, Question Bank, Exam of the Week, and Questions of the Day to the
                  selected subjects. Questions of the Day and Exam Routine stay open for all users.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={user.all_exam_subjects !== false}
                    onChange={(e) =>
                      setUser({
                        ...user,
                        all_exam_subjects: e.target.checked,
                        exam_subject_ids: e.target.checked ? [] : (user.exam_subject_ids ?? []),
                      })
                    }
                  />
                  Allow all exam subjects
                </label>
                {user.all_exam_subjects === false ? (
                  <div className="max-h-56 space-y-2 overflow-y-auto rounded border border-border p-3">
                    {subjectOptions.length === 0 ? (
                      <p className="text-xs text-muted">No exam subjects found.</p>
                    ) : (
                      subjectOptions.map((s) => {
                        const checked = (user.exam_subject_ids ?? []).includes(s.id);
                        return (
                          <label key={s.id} className="flex items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5"
                              checked={checked}
                              onChange={() => {
                                const current = new Set(user.exam_subject_ids ?? []);
                                if (checked) current.delete(s.id);
                                else current.add(s.id);
                                setUser({ ...user, exam_subject_ids: [...current] });
                              }}
                            />
                            <span>{s.label}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>User type</Label>
                  <select
                    className="ibas-select"
                    value={user.user_type}
                    onChange={(e) => setUser({ ...user, user_type: e.target.value })}
                  >
                    {USER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="ibas-select"
                    value={user.status}
                    onChange={(e) => setUser({ ...user, status: e.target.value })}
                  >
                    {USER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={user.is_super_admin}
                  onChange={(e) => setUser({ ...user, is_super_admin: e.target.checked })}
                />
                Super admin
              </label>
              <div className="space-y-3 rounded-lg border border-border p-4">
                <p className="text-sm font-medium">Device access</p>
                <p className="text-xs text-muted">
                  By default each user may use only one device. Grant multi-device access or clear the
                  bound device so they can switch phones.
                </p>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={user.allow_multi_device ?? false}
                    onChange={(e) => setUser({ ...user, allow_multi_device: e.target.checked })}
                  />
                  Allow login from multiple devices
                </label>
                <div className="text-xs text-muted">
                  Bound device:{' '}
                  {user.bound_device_id
                    ? `${user.bound_device_label ?? 'unknown'} (${user.bound_device_id.slice(0, 8)}…)`
                    : 'None'}
                </div>
                <Button type="button" variant="outline" onClick={clearBoundDevice} disabled={!user.bound_device_id}>
                  Clear bound device
                </Button>
                <Button type="button" variant="destructive" onClick={forceLogout}>
                  Force logout all sessions
                </Button>
              </div>
              <Button type="submit">Save profile</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'roles' && (
        <Card>
          <CardHeader>
            <CardTitle>Workflow roles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {activeRoles.length === 0 && (
                <p className="text-sm text-muted">No workflow roles assigned.</p>
              )}
              {activeRoles.map((r) => {
                const meta = roles.find((x) => x.code === r.role_code);
                return (
                  <span
                    key={r.role_code}
                    className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium text-white"
                    style={{ backgroundColor: meta?.color ?? '#888' }}
                  >
                    {r.role_code}
                    <button type="button" className="opacity-80 hover:opacity-100" onClick={() => removeRole(r.role_code)}>
                      ×
                    </button>
                  </span>
                );
              })}
            </div>
            <div className="flex gap-2">
              <select
                className="ibas-select flex-1"
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
              >
                <option value="">Add role...</option>
                {roles
                  .filter((r) => !activeRoles.some((a) => a.role_code === r.code))
                  .map((r) => (
                    <option key={r.code} value={r.code}>
                      {r.code} — {r.name_en}
                    </option>
                  ))}
              </select>
              <Button type="button" onClick={assignRole} disabled={!selectedRole}>
                Assign
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {tab === 'access' &&
        (() => {
          const mobileModules = modules.filter((m) => MOBILE_MODULE_CODES.includes(m.code));
          const otherModules = modules.filter((m) => !MOBILE_MODULE_CODES.includes(m.code));

          const renderModuleCard = (mod: ModuleItem) => {
            const existing = moduleAccess.find((a) => a.module_id === mod._id);
            const draft = accessDraft[mod._id] ?? existing ?? {
              can_read: true,
              can_create: false,
              can_update: false,
              can_delete: false,
              can_grade: false,
              can_publish: false,
              bypass_stop: false,
            };
            const flags = ['can_read', 'can_create', 'can_update', 'can_delete', 'can_grade', 'can_publish'] as const;

            return (
              <div key={mod._id} className="rounded-lg border border-border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{mod.name_en}</div>
                    <div className="text-xs text-muted">{mod.code}</div>
                  </div>
                  {existing && (
                    <Button type="button" variant="outline" size="sm" onClick={() => revokeAccess(mod._id)}>
                      Revoke
                    </Button>
                  )}
                </div>
                <div className="mb-3 flex flex-wrap gap-3">
                  {flags.map((flag) => (
                    <label key={flag} className="flex items-center gap-1 text-xs capitalize">
                      <input
                        type="checkbox"
                        checked={Boolean(draft[flag])}
                        onChange={(e) =>
                          setAccessDraft((prev) => ({
                            ...prev,
                            [mod._id]: { ...draft, [flag]: e.target.checked },
                          }))
                        }
                      />
                      {flag.replace('can_', '')}
                    </label>
                  ))}
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={Boolean(draft.bypass_stop)}
                      onChange={(e) =>
                        setAccessDraft((prev) => ({
                          ...prev,
                          [mod._id]: { ...draft, bypass_stop: e.target.checked },
                        }))
                      }
                    />
                    Allow while module stopped
                  </label>
                </div>
                <Button type="button" size="sm" onClick={() => saveModuleAccess(mod._id)}>
                  {existing ? 'Update access' : 'Grant access'}
                </Button>
              </div>
            );
          };

          return (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Mobile app access
                    <span className="rounded-full bg-primary-muted px-2 py-0.5 text-xs font-medium text-primary-dark">
                      {mobileModules.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {mobileModules.length === 0 ? (
                    <p className="text-sm text-muted">No mobile modules found.</p>
                  ) : (
                    mobileModules.map(renderModuleCard)
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    Other modules
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {otherModules.length}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {otherModules.length === 0 ? (
                    <p className="text-sm text-muted">No other modules found.</p>
                  ) : (
                    otherModules.map(renderModuleCard)
                  )}
                </CardContent>
              </Card>
            </div>
          );
        })()}

      {tab === 'addresses' && (
        <Card>
          <CardHeader>
            <CardTitle>Addresses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {addresses.length === 0 ? (
              <p className="text-sm text-muted">No addresses yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {addresses.map((a) => (
                  <li key={a.id} className="rounded-md border border-border p-3">
                    <span className="font-medium capitalize">{a.address_type}</span>
                    {a.is_primary && <span className="ml-2 text-xs text-primary">Primary</span>}
                    {a.full_address && <p className="mt-1 text-muted">{a.full_address}</p>}
                  </li>
                ))}
              </ul>
            )}
            <form onSubmit={addAddress} className="space-y-4 border-t border-border pt-4">
              <h3 className="font-medium">Add address</h3>
              <div className="space-y-2">
                <Label>Type</Label>
                <select
                  className="ibas-select"
                  value={addrForm.address_type}
                  onChange={(e) =>
                    setAddrForm({ ...addrForm, address_type: e.target.value as typeof addrForm.address_type })
                  }
                >
                  <option value="permanent">Permanent</option>
                  <option value="present">Present</option>
                  <option value="office">Office</option>
                </select>
              </div>
              <GeographyCascade
                divisionId={addrForm.division_id}
                districtId={addrForm.district_id}
                thanaId={addrForm.thana_id}
                onDivisionChange={(id) => setAddrForm({ ...addrForm, division_id: id, district_id: '', thana_id: '' })}
                onDistrictChange={(id) => setAddrForm({ ...addrForm, district_id: id, thana_id: '' })}
                onThanaChange={(id) => setAddrForm({ ...addrForm, thana_id: id })}
              />
              <div className="space-y-2">
                <Label>Full address</Label>
                <Input
                  value={addrForm.full_address}
                  onChange={(e) => setAddrForm({ ...addrForm, full_address: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={addrForm.is_primary}
                  onChange={(e) => setAddrForm({ ...addrForm, is_primary: e.target.checked })}
                />
                Primary address
              </label>
              <Button type="submit" disabled={!addrForm.thana_id}>
                Add address
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {tab === 'activity' && (
        <Card>
          <CardHeader>
            <CardTitle>Activity log</CardTitle>
          </CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted">No activity recorded.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {activity.map((a) => (
                  <li key={a.id} className="flex justify-between border-b border-border py-2 last:border-0">
                    <div>
                      <span className="font-medium">{a.action}</span>
                      {a.description && <span className="ml-2 text-muted">{a.description}</span>}
                    </div>
                    <span className="text-xs text-muted">{new Date(a.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
