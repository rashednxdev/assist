'use client';

import Link from 'next/link';
import { CreditCard, Lock, PauseCircle, ShoppingBag, WifiOff, X } from 'lucide-react';
import { DEFAULT_UNPAID_MESSAGE } from '@ibas/shared-types';
import { SUPPORT_WHATSAPP_DISPLAY, supportWhatsAppHref } from '@/lib/contact';
import { Button } from '@/components/ui/button';

export type AccessRequiredVariant = 'denied' | 'network-error' | 'stopped' | 'unpaid';

export type PackageTab = 'exam_prep' | 'basic' | 'live';

const PACKAGE_COPY: Record<PackageTab, string> = {
  exam_prep: 'This module is part of the Exam Preparation package. Buy a package to open Books, the Question Bank, Exam Papers and every other exam-prep module for the chosen period.',
  basic: 'This module is part of the Basic Module plan. Choose a plan to open Circulars, iBAS++, the Toolkit, Pension and the other basic modules.',
  live: 'This class is sold as part of a Live class package. Buy the package to join every class in it.',
};

const COPY: Record<
  AccessRequiredVariant,
  { icon: typeof Lock; title: string; body: (moduleTitle?: string, stoppedReason?: string) => string }
> = {
  denied: {
    icon: Lock,
    title: 'Access Required',
    body: (moduleTitle) =>
      `${moduleTitle ?? 'This module'} isn't enabled for your account yet. Message us on WhatsApp and we'll turn it on for you.`,
  },
  'network-error': {
    icon: WifiOff,
    title: 'Connection Problem',
    body: () =>
      `We couldn't verify your access right now. Check your connection, or message us on WhatsApp if this keeps happening.`,
  },
  stopped: {
    icon: PauseCircle,
    title: 'Temporarily Unavailable',
    body: (moduleTitle, stoppedReason) =>
      stoppedReason?.trim() || `${moduleTitle ?? 'This module'} is temporarily unavailable. Please check back later.`,
  },
  unpaid: {
    icon: CreditCard,
    title: 'Buy a package to open this',
    body: () => DEFAULT_UNPAID_MESSAGE,
  },
};

export function AccessRequiredDialog({
  variant,
  moduleTitle,
  stoppedReason,
  unpaidMessage,
  packageTab,
  onClose,
}: {
  variant: AccessRequiredVariant;
  moduleTitle?: string;
  stoppedReason?: string;
  unpaidMessage?: string;
  /** Which package tab sells this module; shows "View packages" when set. */
  packageTab?: PackageTab | null;
  onClose: () => void;
}) {
  const copy = COPY[variant];
  const Icon = copy.icon;
  const showPackages = variant === 'unpaid' && !!packageTab;
  const body = showPackages
    ? PACKAGE_COPY[packageTab!]
    : variant === 'unpaid'
      ? unpaidMessage?.trim() || copy.body(moduleTitle)
      : copy.body(moduleTitle, stoppedReason);
  const waText =
    variant === 'unpaid'
      ? `Hi, I'd like to pay to get access to "${moduleTitle ?? 'a module'}" on ProAssist.`
      : variant === 'denied'
        ? `Hi, I'd like to request access to "${moduleTitle ?? 'a module'}" on ProAssist.`
        : `Hi, I'm having trouble connecting to ProAssist and need help.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-surface shadow-xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-white/80 hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="flex flex-col items-center gap-3 bg-gradient-to-br from-primary-dark to-primary px-6 py-8 text-white">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
            <Icon className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold">{copy.title}</h2>
          {moduleTitle && variant !== 'network-error' && (
            <p className="text-sm text-white/80">{moduleTitle}</p>
          )}
        </div>
        <div className="space-y-4 p-6">
          <p className="whitespace-pre-line text-center text-sm leading-relaxed text-foreground">{body}</p>
          {showPackages && (
            <Button asChild className="w-full">
              <Link href={`/packages?tab=${packageTab}`}>
                <ShoppingBag className="h-4 w-4" />
                View packages
              </Link>
            </Button>
          )}
          {variant !== 'stopped' && (
            <div className="space-y-1 text-center">
              <Button
                asChild
                variant={showPackages ? 'outline' : 'default'}
                className={showPackages ? 'w-full' : 'w-full bg-emerald-600 hover:bg-emerald-700'}
              >
                <a href={supportWhatsAppHref(waText)} target="_blank" rel="noopener noreferrer">
                  {showPackages ? 'Pay another way (WhatsApp)' : 'Contact on WhatsApp'}
                </a>
              </Button>
              <p className="text-xs text-muted">{SUPPORT_WHATSAPP_DISPLAY}</p>
            </div>
          )}
          <Button variant="ghost" className="w-full" onClick={onClose}>
            {variant === 'stopped' ? 'Got it' : 'Maybe later'}
          </Button>
        </div>
      </div>
    </div>
  );
}
