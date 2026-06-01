'use client';

import Link from 'next/link';
import {
  ArrowRight,
  GraduationCap,
  Inbox,
  MapPin,
  ScrollText,
  Users,
  Workflow,
} from 'lucide-react';
import type { MeUser } from '@/lib/auth';
import { userDisplayName } from '@/lib/display-text';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const adminLinks = [
  { href: '/admin/users', label: 'Users', desc: 'Manage accounts & access', icon: Users },
  { href: '/exams/admin', label: 'Exam setup', desc: 'Configure programs & syllabus', icon: GraduationCap },
  { href: '/workflow/admin', label: 'Workflow builder', desc: 'Tasks & step definitions', icon: Workflow },
  { href: '/workflow/inbox', label: 'Workflow inbox', desc: 'Pending approvals', icon: Inbox },
  { href: '/admin/setup/geography', label: 'Geography', desc: 'Divisions & districts', icon: MapPin },
  { href: '/admin/audit', label: 'Audit log', desc: 'System activity trail', icon: ScrollText },
];

export function AdminDashboard({ user }: { user: MeUser }) {
  return (
    <div className="space-y-8">
      <PageHeader
        title={`Admin — ${userDisplayName(user)}`}
        description="Platform administration, content management, and workflow oversight."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Role</CardDescription>
            <CardTitle className="text-lg capitalize">{user.user_type.replace('_', ' ')}</CardTitle>
          </CardHeader>
          <CardContent>
            {user.is_super_admin ? (
              <Badge variant="success">Super admin</Badge>
            ) : (
              <Badge variant="secondary">Administrator</Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Workflow roles</CardDescription>
            <CardTitle className="text-lg">
              {user.workflow_roles?.filter((r) => r.is_active).length ?? 0}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1">
            {user.workflow_roles
              ?.filter((r) => r.is_active)
              .map((r) => (
                <Badge key={r.role_code} variant="outline">
                  {r.role_code}
                </Badge>
              )) ?? <span className="text-sm text-muted">None</span>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Content modules</CardDescription>
            <CardTitle className="text-base font-medium">Books · Exams · Papers · Questions</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-lg font-semibold">Administration</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {adminLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="group flex items-start gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{link.label}</span>
                    <ArrowRight className="h-4 w-4 text-muted group-hover:text-primary" />
                  </div>
                  <p className="mt-0.5 text-sm text-muted">{link.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
