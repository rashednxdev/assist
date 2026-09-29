'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, BookOpen, Droplet, HandHeart, HeartHandshake, History, Megaphone, Settings2, Users } from 'lucide-react';
import type { BloodGroup, BloodMe, BloodStats } from '@ibas/shared-types';
import { apiFetch } from '@/lib/api-client';
import { fetchMe } from '@/lib/auth';
import { publishBloodMe, useBloodMe } from '@/lib/use-blood-me';
import { cn } from '@/lib/utils';
import { Alert } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { BloodDrop, EligibilityBadge, formatDate, sinceLabel } from '@/components/blood-bank/blood-bits';
import { BloodProfileForm } from '@/components/blood-bank/blood-profile-form';
import { BloodProfileDialog, DonationDialog } from '@/components/blood-bank/blood-dialogs';
import { DonorList } from '@/components/blood-bank/donor-list';
import { RequestForm, RequestList } from '@/components/blood-bank/blood-requests';
import { DonationHistory } from '@/components/blood-bank/donation-history';
import { BloodGuide } from '@/components/blood-bank/blood-guide';

type Tab = 'donors' | 'requests' | 'donations' | 'guide';
const TABS: Array<{ id: Tab; label: string; icon: typeof Users }> = [
  { id: 'donors', label: 'Find donors', icon: Users },
  { id: 'requests', label: 'Requests', icon: Megaphone },
  { id: 'donations', label: 'My donations', icon: History },
  { id: 'guide', label: 'Guide', icon: BookOpen },
];

function Onboarding({ me }: { me: BloodMe }) {
  return (
    <div className="mx-auto max-w-2xl space-y-5 pt-2">
      <Link href="/community" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-red-700">
        <ArrowLeft className="h-4 w-4" /> Community
      </Link>
      <div className="space-y-3 text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 text-red-600">
          <Droplet className="h-8 w-8 fill-red-500" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Blood bank</h1>
        <p className="text-muted">
          Find blood donors among colleagues, request blood in an emergency, and become a donor yourself. Add your <strong>blood group</strong> to get started.
        </p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-5 shadow-sm">
        <BloodProfileForm me={me} submitLabel="Save and open blood bank" />
      </div>
    </div>
  );
}

function StatTile({ label, value, icon: Icon }: { label: string; value: number; icon: typeof Users }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2">
      <Icon className="h-5 w-5 text-white/80" />
      <div>
        <p className="text-lg font-bold leading-none tabular-nums">{value}</p>
        <p className="text-[11px] text-white/75">{label}</p>
      </div>
    </div>
  );
}

export function BloodBankHome() {
  const { me, error } = useBloodMe();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const tab = (TABS.some((t) => t.id === params.get('tab')) ? params.get('tab') : 'donors') as Tab;

  const [stats, setStats] = useState<BloodStats | null>(null);
  const [donorGroup, setDonorGroup] = useState<BloodGroup | ''>('');
  const [dialog, setDialog] = useState<'donation' | 'settings' | 'request' | null>(null);
  const [account, setAccount] = useState<{ name: string; phone: string } | null>(null);
  const [requestsKey, setRequestsKey] = useState(0);
  const [toggling, setToggling] = useState(false);

  const ready = !!me?.ready;
  useEffect(() => {
    if (!ready) return;
    apiFetch<{ data: BloodStats }>('/blood-bank/stats')
      .then((r) => setStats(r.data))
      .catch(() => setStats(null));
  }, [ready, me?.donor.donation_count, me?.donor.is_donor, me?.blood_group, requestsKey]);

  useEffect(() => {
    fetchMe()
      .then((r) => setAccount({ name: r.data.full_name_en ?? '', phone: r.data.phone ?? '' }))
      .catch(() => undefined);
  }, []);

  function setTab(t: Tab) {
    router.replace(t === 'donors' ? pathname : `${pathname}?tab=${t}`, { scroll: false });
  }

  async function toggleAvailable() {
    if (!me?.blood_group) return;
    setToggling(true);
    try {
      const d = me.donor;
      const r = await apiFetch<{ data: BloodMe }>('/blood-bank/me', {
        method: 'PUT',
        body: JSON.stringify({
          blood_group: me.blood_group,
          is_donor: d.is_donor,
          available: !d.available,
          district_id: d.district?.id ?? '',
          thana_id: d.thana?.id ?? '',
          area: d.area ?? '',
          show_phone: d.show_phone,
          note: d.note ?? '',
        }),
      });
      publishBloodMe(r.data);
    } finally {
      setToggling(false);
    }
  }

  if (error) return <Alert variant="error">{error}</Alert>;
  if (!me) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 rounded-3xl" />
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }
  if (!me.ready) return <Onboarding me={me} />;

  const d = me.donor;

  return (
    <div className="space-y-6">
      <Link href="/community" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-red-700">
        <ArrowLeft className="h-4 w-4" /> Community
      </Link>

      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-600 via-rose-600 to-red-900 p-6 text-white shadow-lg sm:p-8">
        <Droplet className="pointer-events-none absolute -right-8 -top-8 h-48 w-48 fill-white/10 text-white/10" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-5">
            <BloodDrop group={me.blood_group} size="xl" className="from-white to-rose-100 text-red-700" />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/75">Blood bank</p>
              <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
                {me.blood_group ? (d.is_donor ? `You're a ${me.blood_group} donor` : `Your blood group: ${me.blood_group}`) : 'Blood bank moderation'}
              </h1>
              {d.is_donor ? (
                <div className="flex flex-wrap items-center gap-2 text-sm text-white/90">
                  <EligibilityBadge eligible={d.eligible} days={d.days_until_eligible} available={d.available} className="bg-white text-red-700 ring-0" />
                  <span>
                    {sinceLabel(d.last_donation_date)}
                    {!d.eligible && ` · next ${formatDate(d.next_eligible_date)}`}
                  </span>
                </div>
              ) : me.blood_group ? (
                <p className="text-sm text-white/85">Become a donor so people who need {me.blood_group} blood can reach you.</p>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {me.blood_group && (
              <button type="button" onClick={() => setDialog('donation')} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-rose-50">
                <HandHeart className="h-4 w-4" /> I donated
              </button>
            )}
            <button type="button" onClick={() => setDialog('request')} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
              <Megaphone className="h-4 w-4" /> Request blood
            </button>
            <button type="button" onClick={() => setDialog('settings')} className="inline-flex items-center gap-2 rounded-xl bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25">
              <Settings2 className="h-4 w-4" /> {d.is_donor ? 'Donor settings' : me.blood_group ? 'Become a donor' : 'Set blood group'}
            </button>
          </div>
        </div>
        {d.is_donor && (
          <label className="relative mt-5 inline-flex cursor-pointer items-center gap-3 rounded-xl bg-black/15 px-3 py-2 text-sm">
            <input type="checkbox" className="h-4 w-4 rounded" checked={d.available} disabled={toggling} onChange={() => void toggleAvailable()} />
            Available for requests {d.district?.name && <span className="text-white/75">in {d.district.name}</span>}
          </label>
        )}
        {stats && (
          <div className="relative mt-5 flex flex-wrap gap-2">
            <StatTile icon={Users} label="Donors" value={stats.donors} />
            <StatTile icon={HeartHandshake} label="Eligible now" value={stats.eligible} />
            <StatTile icon={Megaphone} label="Open requests" value={stats.open_requests} />
            <StatTile icon={Droplet} label="Donations this year" value={stats.donations_this_year} />
          </div>
        )}
      </header>

      {stats && (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
          {stats.groups.map((g) => (
            <button
              key={g.group}
              type="button"
              onClick={() => {
                setDonorGroup(g.group);
                setTab('donors');
              }}
              className={cn(
                'rounded-2xl border bg-surface p-3 text-center shadow-sm transition hover:border-red-300 hover:shadow-md',
                g.group === me.blood_group ? 'border-red-300 ring-1 ring-red-100' : 'border-border',
              )}
            >
              <p className="text-lg font-extrabold text-red-700">{g.group}</p>
              <p className="text-xs font-semibold tabular-nums">{g.eligible} ready</p>
              <p className="text-[10px] text-muted">{g.donors} donors</p>
            </button>
          ))}
        </div>
      )}

      <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-surface p-1 shadow-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'flex flex-1 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition',
              tab === t.id ? 'bg-red-600 text-white shadow-sm' : 'text-muted hover:bg-slate-50 hover:text-foreground',
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'donors' && <DonorList myGroup={me.blood_group} initialGroup={donorGroup} />}
      {tab === 'requests' && <RequestList me={me} reloadKey={requestsKey} onNew={() => setDialog('request')} />}
      {tab === 'donations' && (me.blood_group ? <DonationHistory me={me} onAdd={() => setDialog('donation')} /> : <Alert>Set your blood group to record donations.</Alert>)}
      {tab === 'guide' && <BloodGuide myGroup={me.blood_group} />}

      {dialog === 'donation' && <DonationDialog onClose={() => setDialog(null)} />}
      {dialog === 'settings' && <BloodProfileDialog me={me} onClose={() => setDialog(null)} />}
      {dialog === 'request' && (
        <RequestForm
          me={me}
          name={account?.name}
          phone={account?.phone}
          onClose={() => setDialog(null)}
          onCreated={(r) => {
            setDialog(null);
            setRequestsKey((k) => k + 1);
            router.push(`/community/blood-bank/requests/${r.id}`);
          }}
        />
      )}
    </div>
  );
}
