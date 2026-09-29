import { Check, HeartPulse, ShieldCheck, X } from 'lucide-react';
import { BLOOD_DONATION_GAP_MONTHS, BLOOD_GROUPS, donorGroupsFor, recipientGroupsOf, type BloodGroup } from '@ibas/shared-types';
import { cn } from '@/lib/utils';

const CAN_DONATE = [
  'Aged 18–60 and in good health',
  'Weight at least 50 kg',
  `At least ${BLOOD_DONATION_GAP_MONTHS} months since your last whole-blood donation`,
  'Haemoglobin around 12.5 g/dL or higher',
  'Had a proper meal and plenty of water beforehand',
];

const PLEASE_WAIT = [
  'Fever, cold or any infection in the last 2 weeks',
  'Pregnant, breastfeeding, or gave birth in the last 6 months',
  'Tattoo, piercing or surgery in the last 6 months',
  'Took antibiotics in the last week',
  'History of hepatitis B/C, HIV or other blood-borne disease',
];

export function BloodGuide({ myGroup }: { myGroup: BloodGroup | null }) {
  return (
    <div className="space-y-6">
      {myGroup && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">You ({myGroup}) can give to</p>
            <p className="mt-1 text-lg font-bold text-red-900">{recipientGroupsOf(myGroup).join(' · ')}</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-red-700">You ({myGroup}) can receive from</p>
            <p className="mt-1 text-lg font-bold text-red-900">{donorGroupsFor(myGroup).join(' · ')}</p>
          </div>
        </div>
      )}

      <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="mb-1 font-semibold">Who can donate to whom</h2>
        <p className="mb-3 text-xs text-muted">Red-cell compatibility. Rows are the donor, columns the patient. O− can give to everyone; AB+ can receive from everyone.</p>
        <div className="ibas-table-wrap overflow-x-auto">
          <table className="w-full min-w-[520px] text-center text-sm">
            <thead>
              <tr>
                <th className="p-2 text-left text-xs font-semibold text-muted">Donor ↓ / Patient →</th>
                {BLOOD_GROUPS.map((g) => (
                  <th key={g} className={cn('p-2 font-bold text-red-700', g === myGroup && 'bg-red-50')}>
                    {g}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {BLOOD_GROUPS.map((donor) => (
                <tr key={donor} className="border-t border-border">
                  <th className={cn('p-2 text-left font-bold text-red-700', donor === myGroup && 'bg-red-50')}>{donor}</th>
                  {BLOOD_GROUPS.map((patient) => {
                    const ok = donorGroupsFor(patient).includes(donor);
                    return (
                      <td key={patient} className={cn('p-2', (donor === myGroup || patient === myGroup) && 'bg-red-50/40')}>
                        {ok ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : <X className="mx-auto h-4 w-4 text-slate-300" />}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <ShieldCheck className="h-5 w-5 text-emerald-600" /> You can usually donate if
          </h2>
          <ul className="space-y-2 text-sm">
            {CAN_DONATE.map((t) => (
              <li key={t} className="flex gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> {t}
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            <HeartPulse className="h-5 w-5 text-red-600" /> Please wait if
          </h2>
          <ul className="space-y-2 text-sm">
            {PLEASE_WAIT.map((t) => (
              <li key={t} className="flex gap-2">
                <X className="mt-0.5 h-4 w-4 shrink-0 text-red-500" /> {t}
              </li>
            ))}
          </ul>
        </section>
      </div>
      <p className="text-xs text-muted">This is general guidance. The blood bank or doctor makes the final decision on the day.</p>
    </div>
  );
}
