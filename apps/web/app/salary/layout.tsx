import { SignedInLayout } from '@/components/layout/signed-in-layout';
import { SalaryAuthGate } from '@/components/salary/salary-auth-gate';
import { SalaryOfficeGate } from '@/components/salary/salary-office-gate';

/** Salary pages use the same shell (top bar + sidebar) as the rest of the learner app. */
export default function SalaryLayout({ children }: { children: React.ReactNode }) {
  return (
    <SignedInLayout>
      <SalaryAuthGate>
        <SalaryOfficeGate>{children}</SalaryOfficeGate>
      </SalaryAuthGate>
    </SignedInLayout>
  );
}
