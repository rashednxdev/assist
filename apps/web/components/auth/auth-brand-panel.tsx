import { Shield } from 'lucide-react';

export function AuthBrandPanel() {
  return (
    <div className="relative hidden flex-1 flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sidebar-active/20 text-sidebar-active">
          <Shield className="h-6 w-6" />
        </div>
        <div>
          <p className="text-xl font-bold">iBAS++ Assistant</p>
          <p className="text-sm text-sidebar-muted">Rules · Exams · Compliance</p>
        </div>
      </div>
      <div className="max-w-md space-y-4">
        <h2 className="text-3xl font-bold leading-tight">
          Your guide to government pay, receipt rules &amp; promotion exams
        </h2>
        <p className="text-sidebar-muted">
          Thousands of offices across Bangladesh rely on clear financial rules. iBAS++ helps government
          service holders learn regulations, prepare for SAS/SRAS exams, and stay compliant — in one place.
        </p>
        <ul className="space-y-2 text-sm text-sidebar-muted">
          <li>• Browse GFR and related rule books</li>
          <li>• Practice with question banks &amp; model papers</li>
          <li>• Track syllabus and exam readiness</li>
        </ul>
      </div>
      <p className="text-xs text-sidebar-muted">Finance Division · Comptroller &amp; Auditor General</p>
    </div>
  );
}

export { isPlatformAdmin } from '@/lib/capabilities';
