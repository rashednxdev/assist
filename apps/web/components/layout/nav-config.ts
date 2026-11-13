import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Layers,
  Bell,
  ScrollText,
  BookOpen,
  GraduationCap,
  FileText,
  Settings,
  Database,
  CalendarClock,
  MessageSquarePlus,
  FileCheck,
  Video,
  MessageCircle,
  BarChart3,
  ShoppingBag,
  Wallet,
  Building2,
  Calculator,
  Radio,
  HelpCircle,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  moduleCode?: string;
  requireCreate?: boolean;
  requireWorkflowRole?: boolean;
  requirePlatformAdmin?: boolean;
  anyModuleCodes?: string[];
}

export interface NavGroup {
  title: string;
  items: NavItem[];
  adminOnly?: boolean;
}

/** Top nav when the user has Salary only (no Learning grant). */
export const salaryPrimaryNav: NavItem[] = [
  { href: '/salary', label: 'Salary On 2026', icon: Calculator },
  { href: '/packages', label: 'Pricing', icon: ShoppingBag },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
];

/** Top-bar link for platform admins, same level as Learning. */
export const salaryBillAccessNavItem: NavItem = {
  href: '/admin/salary-access',
  label: 'Salary bill access',
  icon: Wallet,
  requirePlatformAdmin: true,
};

/** Top nav when Learning is granted (Salary stays available). */
export const learningPrimaryNav: NavItem[] = [
  { href: '/learning', label: 'Learning', icon: LayoutDashboard },
  { href: '/salary', label: 'Salary On 2026', icon: Calculator },
  { href: '/progress', label: 'Progress', icon: BarChart3 },
  { href: '/packages', label: 'Pricing', icon: ShoppingBag },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
];

/** Added only when canHostLive — not present otherwise. */
export const hostLiveNavItem: NavItem = {
  href: '/live/hosting',
  label: 'Host live',
  icon: Radio,
  moduleCode: 'LIVE_STREAM',
  requireCreate: true,
};

/**
 * Composed into Administration only for platform/super admins (and USER grant for manage).
 * Not listed in the base group then filtered — omitted from the array otherwise.
 */
export const userManageNavItem: NavItem = {
  href: '/admin/users',
  label: 'User manage',
  icon: Users,
  requirePlatformAdmin: true,
};

/** Global stop/resume modules — platform/super admin only. */
export const moduleAccessNavItem: NavItem = {
  href: '/admin/setup/modules',
  label: 'Module access',
  icon: Layers,
  requirePlatformAdmin: true,
};

/** USER-grant staff who are not platform admins still get User manage. */
export const userManageByGrantNavItem: NavItem = {
  href: '/admin/users',
  label: 'User manage',
  icon: Users,
  moduleCode: 'USER',
};

/**
 * Admin menu: Learning content + platform admin only.
 * Office / workflow / community are not in this shell.
 * User manage / Module access are composed in `adminNavGroupsFor`.
 */
export const navGroups: NavGroup[] = [
  {
    title: 'Learning admin',
    adminOnly: true,
    items: [
      { href: '/books/admin', label: 'Books', icon: BookOpen, moduleCode: 'BOOKS', requireCreate: true },
      { href: '/questions', label: 'Questions', icon: HelpCircle, moduleCode: 'QUESTIONS', requireCreate: true },
      { href: '/exams/admin', label: 'Exams', icon: GraduationCap, moduleCode: 'EXAM', requireCreate: true },
      { href: '/papers', label: 'Papers', icon: FileText, moduleCode: 'PAPER', requireCreate: true },
      { href: '/qotd/admin', label: 'QOTD', icon: HelpCircle, moduleCode: 'QOTD', requireCreate: true },
      { href: '/exam-routine/admin', label: 'Exam Routine', icon: CalendarClock, moduleCode: 'EXAM_ROUTINE', requireCreate: true },
      { href: '/user-questions/admin', label: 'Submitted Questions', icon: MessageSquarePlus, moduleCode: 'USER_QUESTIONS', requireCreate: true },
      { href: '/live/admin', label: 'Live classes', icon: Video, moduleCode: 'LIVE_STREAM', requireCreate: true },
      { href: '/live/admin/hosts', label: 'Live hosts', icon: Radio, moduleCode: 'LIVE_STREAM', requireCreate: true },
    ],
  },
  {
    title: 'Administration',
    adminOnly: true,
    items: [
      { href: '/admin/offices', label: 'Offices & designations', icon: Building2, requirePlatformAdmin: true },
      { href: '/admin/packages', label: 'Packages & payments', icon: Wallet, requirePlatformAdmin: true },
      { href: '/admin/cache', label: 'Content cache', icon: Database, moduleCode: 'SETUP', requireCreate: true },
      { href: '/admin/audit', label: 'Audit log', icon: ScrollText, moduleCode: 'AUDIT', requireCreate: true },
      { href: '/notifications/admin', label: 'Notifications', icon: Bell, moduleCode: 'NOTICE', requireCreate: true },
      { href: '/admin/terms', label: 'Terms & Conditions', icon: FileCheck, moduleCode: 'SETUP', requireCreate: true },
      {
        href: '/admin/unpaid-message',
        label: 'Unpaid access message',
        icon: MessageCircle,
        moduleCode: 'SETUP',
        requireCreate: true,
      },
      { href: '/admin/salary-access', label: 'Salary bill access', icon: Wallet, requirePlatformAdmin: true },
      { href: '/admin/salary-help', label: 'Salary help', icon: HelpCircle, requirePlatformAdmin: true },
    ],
  },
];
