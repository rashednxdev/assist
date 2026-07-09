import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Inbox,
  ListTodo,
  PlayCircle,
  Route,
  Workflow,
  Users,
  Layers,
  MapPin,
  Bell,
  ScrollText,
  BookOpen,
  Library,
  HelpCircle,
  GraduationCap,
  FileText,
  Settings,
  ScanText,
  Calculator,
} from 'lucide-react';

export interface NavItem {
  href: string;
  /** Fallback label when module name is unavailable */
  label: string;
  icon: LucideIcon;
  /** Platform module code from setup/modules — menu shown when user has matching grant */
  moduleCode?: string;
  /** Admin CRUD link — requires can_create (or can_update) on moduleCode */
  requireCreate?: boolean;
  /** Workflow inbox / run guide — requires an active workflow_roles tag */
  requireWorkflowRole?: boolean;
  /** Regulations and similar — only platform admins (not applicant/officer) */
  requirePlatformAdmin?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  /** Legacy: super-admin-only sections; items still gated per moduleCode */
  adminOnly?: boolean;
}

export const navGroups: NavGroup[] = [
  {
    title: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    title: 'Learning',
    items: [
      { href: '/books', label: 'Rule library', icon: Library, moduleCode: 'BOOKS' },
      { href: '/books/regulations', label: 'Regulations', icon: ScrollText, moduleCode: 'BOOKS', requirePlatformAdmin: true },
      { href: '/questions', label: 'Question bank', icon: HelpCircle, moduleCode: 'QUESTIONS' },
      { href: '/exams', label: 'Exam programs', icon: GraduationCap, moduleCode: 'EXAM' },
      { href: '/papers', label: 'Practice papers', icon: FileText, moduleCode: 'PAPER' },
      { href: '/pension', label: 'Pension calculator', icon: Calculator, moduleCode: 'PENSION' },
    ],
  },
  {
    title: 'Guided processes',
    items: [
      { href: '/guided-tasks', label: 'Process catalog', icon: Route, moduleCode: 'WORKFLOW' },
      { href: '/guided-tasks/my-runs', label: 'My runs', icon: PlayCircle, moduleCode: 'WORKFLOW' },
      {
        href: '/workflow/inbox',
        label: 'Action inbox',
        icon: Inbox,
        moduleCode: 'WORKFLOW',
        requireWorkflowRole: true,
      },
      {
        href: '/workflow/guide',
        label: 'Run guide',
        icon: ListTodo,
        moduleCode: 'WORKFLOW',
        requireWorkflowRole: true,
      },
    ],
  },
  {
    title: 'Tools',
    items: [
      {
        href: '/tools/pdf-to-word',
        label: 'PDF to Word',
        icon: ScanText,
        moduleCode: 'OCR',
      },
    ],
  },
  {
    title: 'Account',
    items: [{ href: '/settings/profile', label: 'Settings', icon: Settings }],
  },
  {
    title: 'Workflow admin',
    adminOnly: true,
    items: [
      { href: '/workflow/inbox', label: 'Inbox', icon: Inbox, moduleCode: 'WORKFLOW', requireCreate: true },
      {
        href: '/workflow/notifications',
        label: 'Notifications',
        icon: Bell,
        moduleCode: 'WORKFLOW',
        requireCreate: true,
      },
      { href: '/workflow/tasks', label: 'Tasks', icon: ListTodo, moduleCode: 'WORKFLOW', requireCreate: true },
      { href: '/workflow/guide', label: 'Run guide', icon: PlayCircle, moduleCode: 'WORKFLOW', requireCreate: true },
      { href: '/workflow/admin', label: 'Workflow admin', icon: Workflow, moduleCode: 'WORKFLOW', requireCreate: true },
    ],
  },
  {
    title: 'Content admin',
    adminOnly: true,
    items: [
      { href: '/books/admin', label: 'Book admin', icon: BookOpen, moduleCode: 'BOOKS', requireCreate: true },
      { href: '/questions/new', label: 'New question', icon: HelpCircle, moduleCode: 'QUESTIONS', requireCreate: true },
      { href: '/exams/admin', label: 'Exam setup', icon: GraduationCap, moduleCode: 'EXAM', requireCreate: true },
      { href: '/papers/new', label: 'New paper', icon: FileText, moduleCode: 'PAPER', requireCreate: true },
      { href: '/admin/setup/pension-leaves', label: 'Pension leave types', icon: Calculator, moduleCode: 'SETUP', requireCreate: true },
    ],
  },
  {
    title: 'Administration',
    adminOnly: true,
    items: [
      { href: '/admin/users', label: 'Users', icon: Users, moduleCode: 'USER', requireCreate: true },
      { href: '/admin/setup/modules', label: 'Modules', icon: Layers, moduleCode: 'SETUP', requireCreate: true },
      { href: '/admin/setup/geography', label: 'Geography', icon: MapPin, moduleCode: 'SETUP', requireCreate: true },
      { href: '/admin/audit', label: 'Audit log', icon: ScrollText, moduleCode: 'AUDIT', requireCreate: true },
    ],
  },
];
