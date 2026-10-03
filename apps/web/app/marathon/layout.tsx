import { SignedInLayout } from '@/components/layout/signed-in-layout';
import { ExamPartScope } from '@/components/exam-prep/exam-part-scope';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <SignedInLayout>
      <ExamPartScope listPath="/marathon">{children}</ExamPartScope>
    </SignedInLayout>
  );
}
