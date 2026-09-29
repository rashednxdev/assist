import { SignedInLayout } from '@/components/layout/signed-in-layout';

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <SignedInLayout>{children}</SignedInLayout>;
}
