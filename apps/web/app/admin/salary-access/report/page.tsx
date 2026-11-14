'use client';

import { SalaryPrintReportView } from '@/components/salary/salary-print-report';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SalaryPrintReportPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Download report</CardTitle>
        <CardDescription>
          Total, free, and other T.R. downloads by Bangladesh date. Open a date to see each user. A staff T.R. Form 15
          counts once per employee.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SalaryPrintReportView path="/salary/admin/print-report" locale="en" showUsers />
      </CardContent>
    </Card>
  );
}
