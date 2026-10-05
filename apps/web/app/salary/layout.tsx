import { SalaryAuthGate } from '@/components/salary/salary-auth-gate';

export default function SalaryLayout({ children }: { children: React.ReactNode }) {
  return <SalaryAuthGate>{children}</SalaryAuthGate>;
}
