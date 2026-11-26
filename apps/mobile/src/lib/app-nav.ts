import type { Href } from 'expo-router';
import type { ComponentProps } from 'react';
import { Ionicons } from '@expo/vector-icons';
import type { LearningModuleCode } from '@/lib/api';

type IoniconName = ComponentProps<typeof Ionicons>['name'];

export interface AppNavItem {
  id: string;
  label: string;
  href: Href;
  icon: IoniconName;
  /** Match active route prefixes (expo-router paths without group). */
  match: string[];
  moduleCode?: LearningModuleCode;
  adminOnly?: boolean;
  usersManageOnly?: boolean;
  section: 'primary' | 'tools' | 'account' | 'admin';
}

/** Same learner menu as web `learningPrimaryNav`, with Ionicons. */
export const APP_PRIMARY_NAV: AppNavItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/(app)/home',
    icon: 'home-outline',
    match: ['/home'],
    section: 'primary',
  },
  {
    id: 'exam-prep',
    label: 'Exam Preparations',
    href: '/(app)/exam-prep',
    icon: 'school-outline',
    match: ['/exam-prep'],
    section: 'primary',
  },
  {
    id: 'live',
    label: 'Live Classes',
    href: '/(app)/live',
    icon: 'videocam-outline',
    match: ['/live', '/zoom'],
    section: 'primary',
  },
  {
    id: 'courses',
    label: 'Courses',
    href: '/(app)/pricing',
    icon: 'bag-handle-outline',
    match: ['/pricing'],
    section: 'primary',
  },
  {
    id: 'my-courses',
    label: 'My Courses',
    href: '/(app)/pricing/payments',
    icon: 'play-circle-outline',
    match: ['/pricing/payments'],
    section: 'primary',
  },
  {
    id: 'books',
    label: 'Rules Library',
    href: '/(app)/books',
    icon: 'book-outline',
    match: ['/books'],
    moduleCode: 'BOOKS',
    section: 'primary',
  },
  {
    id: 'ask',
    label: 'Ask ProAssist',
    href: '/(app)/user-questions',
    icon: 'sparkles-outline',
    match: ['/user-questions'],
    moduleCode: 'USER_QUESTIONS',
    section: 'primary',
  },
  {
    id: 'settings',
    label: 'Settings',
    href: '/(app)/profile',
    icon: 'settings-outline',
    match: ['/profile', '/account'],
    section: 'primary',
  },
];

/** Extra tools still useful outside subject workspace. QOTD / Question Bank / Papers / Marathon live under subjects. */
export const APP_TOOLS_NAV: AppNavItem[] = [
  {
    id: 'progress',
    label: 'Progress',
    href: '/(app)/progress',
    icon: 'stats-chart-outline',
    match: ['/progress'],
    section: 'tools',
  },
  {
    id: 'salary',
    label: 'Salary',
    href: '/(app)/salary',
    icon: 'wallet-outline',
    match: ['/salary'],
    section: 'tools',
  },
  {
    id: 'exam-week',
    label: 'Exam of the Week',
    href: '/(app)/exam-week',
    icon: 'calendar-outline',
    match: ['/exam-week'],
    moduleCode: 'EXAM_WEEK',
    section: 'tools',
  },
  {
    id: 'exam-routine',
    label: 'Exam Routine',
    href: '/(app)/exam-routine',
    icon: 'time-outline',
    match: ['/exam-routine'],
    moduleCode: 'EXAM_ROUTINE',
    section: 'tools',
  },
];

export const APP_ADMIN_NAV: AppNavItem[] = [
  {
    id: 'question-update',
    label: 'Question Update',
    href: '/(app)/question-update',
    icon: 'create-outline',
    match: ['/question-update'],
    moduleCode: 'QUESTION_EDIT',
    section: 'admin',
  },
  {
    id: 'salary-access',
    label: 'Salary bill access',
    href: '/(app)/salary-access',
    icon: 'card-outline',
    match: ['/salary-access'],
    adminOnly: true,
    section: 'admin',
  },
  {
    id: 'users',
    label: 'User manage',
    href: '/(app)/users',
    icon: 'people-outline',
    match: ['/users'],
    usersManageOnly: true,
    section: 'admin',
  },
];

export function pathIsActive(pathname: string | null | undefined, item: AppNavItem): boolean {
  if (!pathname) return false;
  const clean = pathname.replace(/^\/\(app\)/, '') || '/home';
  // Prefer more specific matches first for Courses vs My Courses.
  if (item.id === 'courses') {
    return clean === '/pricing' || clean.startsWith('/pricing/checkout');
  }
  if (item.id === 'my-courses') {
    return clean.startsWith('/pricing/payments');
  }
  return item.match.some((prefix) => clean === prefix || clean.startsWith(`${prefix}/`));
}
