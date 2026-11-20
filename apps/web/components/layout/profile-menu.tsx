'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CheckCircle2,
  ChevronDown,
  Download,
  GraduationCap,
  KeyRound,
  LogOut,
  PlayCircle,
  Target,
  TrendingUp,
  UserRound,
} from 'lucide-react';
import type { PreparationSubjectSummary } from '@ibas/shared-types';
import type { MeUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api-client';
import { isPlatformAdmin } from '@/lib/capabilities';
import { userDisplayName } from '@/lib/display-text';
import { cn } from '@/lib/utils';

export function avatarInitials(me: MeUser | null): string {
  if (!me) return 'প্র';
  const raw = (me.full_name_bn?.trim() || userDisplayName(me) || '').trim();
  if (!raw) return 'প্র';
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const first = Array.from(parts[0]!)[0] ?? '';
    const second = Array.from(parts[1]!)[0] ?? '';
    return `${first}${second}`;
  }
  return Array.from(raw).slice(0, 2).join('');
}

interface MenuLink {
  href: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

const MENU_LINKS: MenuLink[] = [
  { href: '/settings/profile', label: 'My Profile', hint: 'Name, contact and office', icon: UserRound },
  { href: '/settings/payments', label: 'My Courses', hint: 'Enrolled courses and payments', icon: PlayCircle },
  { href: '/progress', label: 'Exams & Progress', hint: 'Results, accuracy and history', icon: GraduationCap },
  { href: '/salary/downloads', label: 'My Downloads', hint: 'Saved arrear bills and forms', icon: Download },
  { href: '/notifications', label: 'Notifications', hint: 'Latest notices for you', icon: Bell },
  { href: '/settings/password', label: 'Change Password', hint: 'Keep your account secure', icon: KeyRound },
];

function Stat({ icon: Icon, value, label }: { icon: LucideIcon; value: string; label: string }) {
  return (
    <div className="rounded-xl bg-[#f4f9fd] px-2.5 py-2 text-center">
      <Icon className="mx-auto h-3.5 w-3.5 text-[#1566b8]" />
      <p className="mt-1 text-sm font-extrabold text-[#0a2f5b]">{value}</p>
      <p className="text-[10px] font-medium leading-tight text-slate-500">{label}</p>
    </div>
  );
}

/** Top-right profile drop-down: account summary + shortcuts to downloads, exams, profile, courses. */
export function ProfileMenu({ me, onLogout }: { me: MeUser | null; onLogout: () => void }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [subjects, setSubjects] = useState<PreparationSubjectSummary[] | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function onPointer(event: MouseEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !me || subjects) return;
    let live = true;
    apiFetch<{ data: PreparationSubjectSummary[] }>('/exam-prep/subjects')
      .then((res) => {
        if (live) setSubjects(res.data);
      })
      .catch(() => {
        if (live) setSubjects([]);
      });
    return () => {
      live = false;
    };
  }, [open, me, subjects]);

  const summary = useMemo(() => {
    const owned = (subjects ?? []).filter((s) => s.owned);
    const progress = owned.length
      ? Math.round(owned.reduce((sum, s) => sum + s.progress_percent, 0) / owned.length)
      : 0;
    const touched = owned.reduce((sum, s) => sum + s.mcq_touched, 0);
    const correct = owned.reduce((sum, s) => sum + s.mcq_correct, 0);
    const accuracy = touched > 0 ? Math.round((correct / touched) * 100) : 0;
    return { courses: owned.length, progress, accuracy };
  }, [subjects]);

  const name = me ? userDisplayName(me) : '';
  const contact = me?.phone?.trim() || me?.email?.trim() || '';
  const enrolled = Boolean(me && (me.has_paid || isPlatformAdmin(me)));
  const loading = open && me != null && subjects === null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Open profile menu"
        title={name || 'Profile'}
        className="flex h-9 items-center gap-1 rounded-full bg-[#d7e8f8] py-0 pl-0 pr-2 text-xs font-bold text-[#0a2f5b] ring-1 ring-[#7eb6ea]/50 transition hover:bg-[#c3ddf6]"
      >
        <span className="flex h-9 w-9 items-center justify-center">{avatarInitials(me)}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-[min(92vw,20rem)] overflow-hidden rounded-2xl border border-[#d7e4ee] bg-white shadow-xl"
        >
          <div className="flex items-center gap-3 border-b border-[#eef4f9] bg-[#f4f9fd] p-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#0a2f5b] text-sm font-bold text-white">
              {avatarInitials(me)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#0a2f5b]">{name || 'Your account'}</p>
              {contact ? <p className="truncate text-xs text-slate-500">{contact}</p> : null}
              <span
                className={cn(
                  'mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold',
                  enrolled ? 'bg-[#e6f6f8] text-[#0e7490]' : 'bg-[#d7e8f8] text-[#1566b8]',
                )}
              >
                <CheckCircle2 className="h-3 w-3" />
                {enrolled ? 'Enrolled' : 'Free account'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-b border-[#eef4f9] p-3">
            <Stat icon={PlayCircle} value={loading ? '…' : String(summary.courses)} label="Courses" />
            <Stat icon={TrendingUp} value={loading ? '…' : `${summary.progress}%`} label="Progress" />
            <Stat icon={Target} value={loading ? '…' : `${summary.accuracy}%`} label="MCQ accuracy" />
          </div>

          <nav className="p-1.5">
            {MENU_LINKS.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-xl px-3 py-2 transition hover:bg-[#f4f9fd]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#eaf4fc] text-[#1566b8]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#0a2f5b]">{item.label}</span>
                    <span className="block truncate text-[11px] text-slate-500">{item.hint}</span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[#eef4f9] p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50">
                <LogOut className="h-4 w-4" />
              </span>
              Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
