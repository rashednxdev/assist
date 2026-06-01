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
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

export interface NavGroup {
  title: string;
  items: NavItem[];
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
      { href: '/books', label: 'Rule library', icon: Library },
      { href: '/books/regulations', label: 'Regulations', icon: ScrollText },
      { href: '/questions', label: 'Question bank', icon: HelpCircle },
      { href: '/exams', label: 'Exam programs', icon: GraduationCap },
      { href: '/papers', label: 'Practice papers', icon: FileText },
    ],
  },
  {
    title: 'Guided processes',
    items: [
      { href: '/guided-tasks', label: 'Process catalog', icon: Route },
      { href: '/guided-tasks/my-runs', label: 'My runs', icon: PlayCircle },
      { href: '/workflow/inbox', label: 'Action inbox', icon: Inbox },
      { href: '/workflow/guide', label: 'Run guide', icon: ListTodo },
    ],
  },
  {
    title: 'Account',
    items: [{ href: '/settings/profile', label: 'Settings', icon: Settings }],
  },
  {
    title: 'Workflow',
    adminOnly: true,
    items: [
      { href: '/workflow/inbox', label: 'Inbox', icon: Inbox },
      { href: '/workflow/notifications', label: 'Notifications', icon: Bell },
      { href: '/workflow/tasks', label: 'Tasks', icon: ListTodo },
      { href: '/workflow/guide', label: 'Run guide', icon: PlayCircle },
      { href: '/workflow/admin', label: 'Workflow admin', icon: Workflow },
    ],
  },
  {
    title: 'Content admin',
    adminOnly: true,
    items: [
      { href: '/books/admin', label: 'Book admin', icon: BookOpen },
      { href: '/questions/new', label: 'New question', icon: HelpCircle },
      { href: '/exams/admin', label: 'Exam setup', icon: GraduationCap },
      { href: '/papers/new', label: 'New paper', icon: FileText },
    ],
  },
  {
    title: 'Administration',
    adminOnly: true,
    items: [
      { href: '/admin/users', label: 'Users', icon: Users },
      { href: '/admin/setup/modules', label: 'Modules', icon: Layers },
      { href: '/admin/setup/geography', label: 'Geography', icon: MapPin },
      { href: '/admin/audit', label: 'Audit log', icon: ScrollText },
    ],
  },
];
