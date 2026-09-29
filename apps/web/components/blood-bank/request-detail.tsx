'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CalendarClock, CheckCircle2, Droplet, Hospital, Loader2, MapPin, Share2, Trash2, User, XCircle } from 'lucide-react';
import { donorGroupsFor, type BloodRequestRecord } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { useBloodMe } from '@/lib/use-blood-me';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { BloodDrop, EligibilityBadge, formatDate, formatDateTime, URGENCY_STYLE } from '@/components/blood-bank/blood-bits';
import { CallRow, RequestStatus, RespondButton } from '@/components/blood-bank/blood-requests';
import { DonationDialog } from '@/components/blood-bank/blood-dialogs';

export function RequestDetail({ id }: { id: string }) {
  const router = useRouter();
  const { me } = useBloodMe();
  const [r, setR] = useState<BloodRequestRecord | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [donating, setDonating] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    apiFetch<{ data: BloodRequestRecord }>(`/blood-bank/requests/${id}`)
      .then((res) => setR(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load the request'));
  }, [id]);

  async function setStatus(status: 'open' | 'fulfilled' | 'cancelled') {
    setBusy(true);
    setError('');
    try {
      const res = await apiFetch<{ data: BloodRequestRecord }>(`/blood-bank/requests/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      setR(res.data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm('Delete this request? This cannot be undone.')) return;
    setBusy(true);
    try {
      await apiFetch(`/blood-bank/requests/${id}`, { method: 'DELETE' });
      router.push('/community/blood-bank?tab=requests');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete');
      setBusy(false);
    }
  }

  function share() {
    if (!r) return;
    const text = `${r.blood_group} blood needed (${r.units} bag${r.units === 1 ? '' : 's'}) at ${r.hospital}${r.district?.name ? `, ${r.district.name}` : ''} by ${formatDateTime(r.needed_on)}. Contact ${r.contact_name}: ${r.contact_phone}`;
    const url = window.location.href;
    if (navigator.share) {
      void navigator.share({ title: `${r.blood_group} blood needed`, text, url }).catch(() => undefined);
    } else {
      void navigator.clipboard?.writeText(`${text}\n${url}`).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  }

  const back = (
    <Link href="/community/blood-bank?tab=requests" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-red-700">
      <ArrowLeft className="h-4 w-4" /> Blood requests
    </Link>
  );

  if (error && !r) {
    return (
      <div className="space-y-4">
        {back}
        <Alert variant="error">{error}</Alert>
      </div>
    );
  }
  if (!r) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-64 rounded-3xl" />
      </div>
    );
  }

  const canManage = r.is_mine || me?.is_admin;
  const u = URGENCY_STYLE[r.urgency];
  const place = [r.address, r.thana?.name, r.district?.name].filter(Boolean).join(', ');
  let blockReason: string | undefined;
  if (r.status !== 'open') blockReason = 'This request is closed.';
  else if (r.is_mine) blockReason = undefined;
  else if (!me?.blood_group) blockReason = 'Add your blood group first.';
  else if (!r.compatible) blockReason = `${me.blood_group} can't be given to a ${r.blood_group} patient.`;
  else if (!me.donor.eligible) blockReason = `You can donate again from ${formatDate(me.donor.next_eligible_date)}.`;

  return (
    <div className="space-y-6">
      {back}
      <div className="overflow-hidden rounded-3xl border border-border bg-surface shadow-sm">
        <div className="flex flex-wrap items-center gap-5 bg-gradient-to-br from-red-600 via-rose-600 to-red-800 p-6 text-white">
          <BloodDrop group={r.blood_group} size="xl" className="from-white to-rose-100 text-red-700" />
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {r.status === 'open' ? <span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-white/40', u.className)}>{u.label}</span> : <RequestStatus status={r.status} />}
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold">
                {r.units} bag{r.units === 1 ? '' : 's'}
              </span>
            </div>
            <h1 className="text-2xl font-bold leading-tight">{r.blood_group} blood needed</h1>
            <p className="text-sm text-white/85">Compatible donors: {donorGroupsFor(r.blood_group).join(', ')}</p>
          </div>
          <button type="button" onClick={share} className="inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/25">
            <Share2 className="h-4 w-4" /> {copied ? 'Copied' : 'Share'}
          </button>
        </div>

        <div className="grid gap-6 p-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2">
              <Hospital className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
              <span className="font-semibold">{r.hospital}</span>
            </p>
            {place && (
              <p className="flex items-start gap-2 text-muted">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> {place}
              </p>
            )}
            <p className="flex items-center gap-2 text-muted">
              <CalendarClock className="h-4 w-4 shrink-0" /> Needed by <strong className="text-foreground">{formatDateTime(r.needed_on)}</strong>
            </p>
            {r.patient_name && (
              <p className="flex items-center gap-2 text-muted">
                <User className="h-4 w-4 shrink-0" /> Patient: <span className="text-foreground">{r.patient_name}</span>
              </p>
            )}
            {r.note && <p className="whitespace-pre-line rounded-xl bg-slate-50 p-3 text-foreground">{r.note}</p>}
            <p className="text-xs text-muted">
              Posted by {r.requester.name} · {formatDateTime(r.created_at)}
            </p>
          </div>
          <div className="space-y-3">
            <CallRow name={r.contact_name} phone={r.contact_phone} />
            {!r.is_mine && (
              <>
                <RespondButton r={r} onChange={setR} disabledReason={blockReason} />
                {r.i_responded && (
                  <Button variant="outline" className="w-full" onClick={() => setDonating(true)}>
                    <Droplet className="h-4 w-4 text-red-600" /> I donated for this request
                  </Button>
                )}
              </>
            )}
            {canManage && (
              <div className="flex flex-wrap gap-2 border-t border-border pt-3">
                {r.status === 'open' && (
                  <>
                    <Button size="sm" onClick={() => setStatus('fulfilled')} disabled={busy} className="bg-emerald-600 hover:bg-emerald-700">
                      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Got blood
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setStatus('cancelled')} disabled={busy}>
                      <XCircle className="h-3.5 w-3.5" /> Cancel
                    </Button>
                  </>
                )}
                {(r.status === 'fulfilled' || r.status === 'cancelled') && (
                  <Button size="sm" variant="outline" onClick={() => setStatus('open')} disabled={busy}>
                    Reopen
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={remove} disabled={busy} className="text-destructive hover:bg-destructive-light hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </div>
            )}
            {error && <Alert variant="error">{error}</Alert>}
          </div>
        </div>
      </div>

      {r.responders && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">
            Donors who offered ({r.responders.length})
          </h2>
          {r.responders.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
              No offers yet. Share this request — donors of compatible groups nearby were notified.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {r.responders.map((d) => (
                <div key={d.id} className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
                  <BloodDrop group={d.blood_group} />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-semibold">{d.name}</p>
                    {(d.designation || d.office) && <p className="truncate text-xs text-muted">{[d.designation, d.office].filter(Boolean).join(', ')}</p>}
                    <div className="flex flex-wrap items-center gap-2">
                      <EligibilityBadge eligible={d.eligible} days={0} />
                      <span className="text-xs text-muted">offered {formatDateTime(d.at)}</span>
                    </div>
                    {d.note && <p className="text-xs text-foreground">“{d.note}”</p>}
                  </div>
                  {d.phone && (
                    <a href={`tel:${d.phone}`} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-red-600 px-3 text-sm font-semibold text-white hover:bg-red-700">
                      Call
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {donating && <DonationDialog requestId={r.id} onClose={() => setDonating(false)} />}
    </div>
  );
}
