import type { LucideIcon } from 'lucide-react';
import {
  BookOpen,
  CalendarDays,
  FileText,
  GraduationCap,
  HelpCircle,
  MessageSquarePlus,
  Radio,
  Timer,
  Trophy,
  Video,
  Zap,
} from 'lucide-react';

/** Learner tiles for the web Learning hub (parity with mobile exam-prep). */
export interface LearningModuleTile {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  href: string;
  color: string;
  icon: LucideIcon;
}

/** Always listed on the Learning hub (access dialog handles unpaid/locked). */
export const LEARNING_MODULE_TILES: LearningModuleTile[] = [
  {
    id: 'books',
    code: 'BOOKS',
    title: 'Books & Tools',
    subtitle: 'Books & regulatory tools',
    href: '/books',
    color: '#0f5c8c',
    icon: BookOpen,
  },
  {
    id: 'paper',
    code: 'PAPER',
    title: 'Exam Papers',
    subtitle: 'Session-wise model papers',
    href: '/papers',
    color: '#d97706',
    icon: FileText,
  },
  {
    id: 'live',
    code: 'LIVE_STREAM',
    title: 'Live class',
    subtitle: 'By subject · hosts & schedule',
    href: '/live',
    color: '#0369a1',
    icon: Video,
  },
  {
    id: 'questions',
    code: 'QUESTIONS',
    title: 'Question Bank',
    subtitle: 'Browse & practice questions',
    href: '/questions',
    color: '#7c3aed',
    icon: HelpCircle,
  },
  {
    id: 'exam',
    code: 'EXAM',
    title: 'Exam Programs',
    subtitle: 'SAS, SRAS & exam structure',
    href: '/exams',
    color: '#059669',
    icon: GraduationCap,
  },
  {
    id: 'qotd',
    code: 'QOTD',
    title: 'Questions of the Day',
    subtitle: 'Daily subject-wise questions',
    href: '/qotd',
    color: '#047857',
    icon: CalendarDays,
  },
  {
    id: 'exam-week',
    code: 'EXAM_WEEK',
    title: 'Exams of the Week',
    subtitle: 'Featured exam papers, by week',
    href: '/exam-week',
    color: '#6d28d9',
    icon: Trophy,
  },
  {
    id: 'exam-routine',
    code: 'EXAM_ROUTINE',
    title: 'Exam Routine',
    subtitle: 'Schedules, countdown & instructions',
    href: '/exam-routine',
    color: '#7c2d12',
    icon: Timer,
  },
];

/** Only composed into the hub when QUESTION_EDIT is granted. */
export const QUESTION_UPDATE_TILE: LearningModuleTile = {
  id: 'question-update',
  code: 'QUESTION_EDIT',
  title: 'Question Update',
  subtitle: 'Review & edit questions and answers',
  href: '/questions',
  color: '#B45309',
  icon: HelpCircle,
};

export const MARATHON_LINK = {
  id: 'marathon',
  code: 'QUESTIONS',
  title: 'Marathon Review',
  subtitle: 'Short Q&A on Books & Tools',
  href: '/marathon',
  color: '#0f5c8c',
  icon: Zap,
} as const;

/** Only composed when USER_QUESTIONS is open. */
export const SUBMIT_QUESTION_LINK = {
  id: 'user-questions',
  code: 'USER_QUESTIONS',
  title: 'Submit a Question',
  subtitle: 'Ask for a subject — admin will review',
  href: '/user-questions',
  color: '#4d7c0f',
  icon: MessageSquarePlus,
} as const;

/** Only composed when canHostLive. */
export const HOST_LIVE_LINK = {
  id: 'hosting',
  code: 'LIVE_STREAM',
  title: 'Host live',
  subtitle: 'Your permitted schedule',
  href: '/live/hosting',
  color: '#0e7490',
  icon: Radio,
} as const;
