import { SignedInLayout } from '@/components/layout/signed-in-layout';

export default function ContactsLayout({ children }: { children: React.ReactNode }) {
  return <SignedInLayout>{children}</SignedInLayout>;
}
