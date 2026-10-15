'use client';

import { SalaryPrintReportView } from '@/components/salary/salary-print-report';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function SalaryPrintReportPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Print report</CardTitle>
        <CardDescription>
          T.R. Form downloads by all users, per Bangladesh date. Each office staff T.R. Form 15 counts once per employee.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SalaryPrintReportView path="/salary/admin/print-report" locale="en" showUsers />
      </CardContent>
    </Card>
  );
}
