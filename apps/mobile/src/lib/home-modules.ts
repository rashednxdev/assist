import type { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import type { LearningModuleCode } from '@/lib/api';
import { qotdColors } from '@/lib/qotd-theme';
import { examWeekColors } from '@/lib/exam-week-theme';

export interface GatedModule {
  id: string;
  code: LearningModuleCode;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  href: Href;
}

/** Exam-preparation modules, shown on the Exam Preparation screen. */
export const EXAM_MODULES: GatedModule[] = [
  {
    id: 'books',
    code: 'BOOKS',
    title: 'Books & Tools',
    subtitle: 'Books & regulatory tools',
    icon: 'library-outline',
    color: '#0f5c8c',
    href: '/(app)/books' as Href,
  },
  {
    id: 'paper',
    code: 'PAPER',
    title: 'Exam Papers',
    subtitle: 'Session-wise model papers',
    icon: 'document-text-outline',
    color: '#d97706',
    href: '/(app)/papers' as Href,
  },
  {
    id: 'live',
    code: 'LIVE_STREAM',
    title: 'Live class',
    subtitle: 'Upcoming, live & previous',
    icon: 'videocam-outline',
    color: '#0369a1',
    href: '/(app)/live' as Href,
  },
  {
    id: 'questions',
    code: 'QUESTIONS',
    title: 'Question Bank',
    subtitle: 'Browse & practice questions',
    icon: 'list-outline',
    color: '#7c3aed',
    href: '/(app)/questions' as Href,
  },
  {
    id: 'exam',
    code: 'EXAM',
    title: 'Exam Programs',
    subtitle: 'SAS, SRAS & exam structure',
    icon: 'school-outline',
    color: '#059669',
    href: '/(app)/exams' as Href,
  },
  {
    id: 'qotd',
    code: 'QOTD',
    title: 'Questions of the Day',
    subtitle: 'Daily subject-wise questions',
    icon: 'calendar-outline',
    color: qotdColors.accent,
    href: '/(app)/qotd' as Href,
  },
  {
    id: 'exam-week',
    code: 'EXAM_WEEK',
    title: 'Exams of the Week',
    subtitle: 'Featured exam papers, by week',
    icon: 'trophy-outline',
    color: examWeekColors.accent,
    href: '/(app)/exam-week' as Href,
  },
  {
    id: 'exam-routine',
    code: 'EXAM_ROUTINE',
    title: 'Exam Routine',
    subtitle: 'Schedules, countdown & instructions',
    icon: 'time-outline',
    color: '#7c2d12',
    href: '/(app)/exam-routine' as Href,
  },
  {
    id: 'question-update',
    code: 'QUESTION_EDIT',
    title: 'Question Update',
    subtitle: 'Review & edit questions and answers',
    icon: 'create-outline',
    color: '#B45309',
    href: '/(app)/question-update' as Href,
  },
];

/** Pension calculators, shown on the Salary On 2026 & Calculations hub. */
export const PENSION_TOOLS: GatedModule[] = [
  {
    id: 'pension',
    code: 'PENSION',
    title: 'Pension Calculator',
    subtitle: 'Leave math & lamp grant',
    icon: 'calculator-outline',
    color: '#0e7490',
    href: '/(app)/pension' as Href,
  },
  {
    id: 'joining-period',
    code: 'PENSION',
    title: 'Joining Period',
    subtitle: 'Prep + travel math',
    icon: 'calculator-outline',
    color: '#0369a1',
    href: '/(app)/joining-period' as Href,
  },
];
