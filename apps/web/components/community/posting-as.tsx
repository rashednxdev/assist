'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Building2, Pencil } from 'lucide-react';
import { fetchMe } from '@/lib/auth';
import { isPlatformAdmin } from '@/lib/capabilities';
import { useWorkIdentity } from '@/lib/use-work-identity';
import { officeLabel } from '@/components/org/office-picker';
import { WorkIdentityForm } from '@/components/org/work-identity-form';

let adminCache: boolean | null = null;

/** Whether the user may post now: members need office + designation, admins don't. */
export function useCanPost() {
  const { identity, loading, complete } = useWorkIdentity();
  const [admin, setAdmin] = useState<boolean | null>(adminCache);
  useEffect(() => {
    if (adminCache !== null) return;
    fetchMe()
      .then((r) => {
        adminCache = isPlatformAdmin(r.data);
        setAdmin(adminCache);
      })
      .catch(() => setAdmin(false));
  }, []);
  const ready = complete || admin === true;
  return { identity, complete, admin: !!admin, loading: loading || admin === null, ready };
}

/** "Posting as Designation, Office" bar; asks for the details inline when they're missing. */
export function PostingAs({ forceEdit, onEditDone }: { forceEdit?: boolean; onEditDone?: () => void }) {
  const { identity, complete, admin, loading } = useCanPost();
  const [editing, setEditing] = useState(false);
  const open = editing || !!forceEdit;

  if (loading) return <div className="h-11 animate-pulse rounded-xl bg-slate-100" />;

  if (!complete && !admin) {
    return (
      <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-2 text-sm text-amber-900">
          <Building2 className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>Add your designation and office to post.</strong> They are shown with your name so colleagues know who is asking or answering. You only need to do this once.
          </p>
        </div>
        <WorkIdentityForm submitLabel="Save and continue" onSaved={() => onEditDone?.()} />
      </div>
    );
  }

  if (open) {
    return (
      <div className="space-y-3 rounded-xl border border-border bg-slate-50 p-4">
        <p className="text-sm font-medium">Update your designation and office</p>
        <WorkIdentityForm
          submitLabel="Save"
          onSaved={() => {
            setEditing(false);
            onEditDone?.();
          }}
          onCancel={() => {
            setEditing(false);
            onEditDone?.();
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-slate-50/70 px-3 py-2 text-sm">
      <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-muted">Posting as</span>
      {complete && identity?.designation && identity.office ? (
        <span className="min-w-0 flex-1 truncate font-medium">
          {identity.designation.name}, {officeLabel(identity.office)}
        </span>
      ) : (
        <span className="min-w-0 flex-1 truncate font-medium">Administrator</span>
      )}
      <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
        <Pencil className="h-3 w-3" /> {complete ? 'Change' : 'Add office'}
      </button>
    </div>
  );
}
