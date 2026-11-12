import { SignedInLayout } from '@/components/layout/signed-in-layout';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <SignedInLayout>{children}</SignedInLayout>;
}
