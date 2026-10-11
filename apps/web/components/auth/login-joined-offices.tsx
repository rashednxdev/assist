'use client';

import { useEffect, useState } from 'react';
import { Building2 } from 'lucide-react';
import type { SalaryJoinedOfficesRecord } from '@ibas/shared-types';

/** Number of offices using the salary page; every user who saved an office counts as one. */
export function LoginJoinedOffices() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/proxy/v1/salary/public/joined-offices')
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { data: SalaryJoinedOfficesRecord } | null) => setCount(body?.data.joined_offices ?? null))
      .catch(() => undefined);
  }, []);

  if (count == null) return null;
  return (
    <div className="flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-5 py-4 text-center shadow-md">
      <p className="flex items-center gap-3 text-2xl font-extrabold text-[#0b3d2e] sm:text-3xl">
        <Building2 className="h-7 w-7 sm:h-8 sm:w-8" />
        Join Offices <span className="tabular-nums text-emerald-700">{count.toLocaleString('en-US')}</span>
      </p>
      <p lang="bn" className="text-[0.8rem] font-semibold text-[#b71c1c] sm:text-[0.9rem]">
        আপনার প্রতিষ্ঠান হতে যে কোন একজন সবার টিআর ফরম ডাউনলোড করুন
      </p>
    </div>
  );
}
