import type { LucideIcon } from 'lucide-react';
import {
  Home,
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
  ShoppingBag,
  Wallet,
  Building2,
  Radio,
  HelpCircle,
  PlayCircle,
  Sparkles,
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

/** Top-bar link for platform admins, same level as Home. */
export const salaryBillAccessNavItem: NavItem = {
  href: '/admin/salary-access',
  label: 'Salary bill access',
  icon: Wallet,
  requirePlatformAdmin: true,
};

/**
 * Primary learner sidebar. Labels are always English, whatever the page language.
 * Same menu for every signed-in user.
 */
/** Learner sidebar — heavy extras (news, community, calendar, directory, calculator) omitted so they are not prefetched. */
export const learningPrimaryNav: NavItem[] = [
  { href: '/home', label: 'Home', icon: Home },
  { href: '/exam-prep', label: 'Exam Preparations', icon: GraduationCap },
  { href: '/live', label: 'Live Classes', icon: Video },
  { href: '/packages', label: 'Courses', icon: ShoppingBag },
  { href: '/settings/payments', label: 'My Courses', icon: PlayCircle },
  { href: '/books', label: 'Rules Library', icon: BookOpen, moduleCode: 'BOOKS' },
  { href: '/user-questions', label: 'Ask ProAssist', icon: Sparkles, moduleCode: 'USER_QUESTIONS' },
  { href: '/settings/profile', label: 'Settings', icon: Settings },
];

/** Added only when canHostLive — not present otherwise. */
export const hostLiveNavItem: NavItem = {
  href: '/live/hosting',
  label: 'Live Host',
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
