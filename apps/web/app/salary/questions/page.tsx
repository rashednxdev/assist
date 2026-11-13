'use client';

import { SalaryHelp } from '@/components/salary/salary-help';
import { SalarySubpage } from '@/components/salary/salary-subpage';
import { useSalaryUser } from '@/components/salary/salary-auth-gate';
import { isPlatformAdmin } from '@/lib/capabilities';

export default function SalaryQuestionsPage() {
  const me = useSalaryUser();
  return <SalarySubpage>{(locale) => <SalaryHelp locale={locale} isAdmin={isPlatformAdmin(me)} fullPage />}</SalarySubpage>;
}
