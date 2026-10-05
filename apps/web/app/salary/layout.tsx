import { SalaryAuthGate } from '@/components/salary/salary-auth-gate';
import { SalaryOfficeGate } from '@/components/salary/salary-office-gate';

export default function SalaryLayout({ children }: { children: React.ReactNode }) {
  return (
    <SalaryAuthGate>
      <SalaryOfficeGate>{children}</SalaryOfficeGate>
    </SalaryAuthGate>
  );
}
