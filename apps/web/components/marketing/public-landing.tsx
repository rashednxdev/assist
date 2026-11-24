'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Calculator, ClipboardCheck, GraduationCap, Video } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';
import { WEB_REGISTRATION_OPEN } from '@/lib/registration';
import {
  landingCopy,
  readLandingLocale,
  writeLandingLocale,
  type LandingLocale,
} from '@/lib/landing-i18n';
import { cn } from '@/lib/utils';

const LOGIN = '/login';
const START = WEB_REGISTRATION_OPEN ? '/register' : '/login';

function LangToggle({
  locale,
  onChange,
  bnLabel,
  enLabel,
}: {
  locale: LandingLocale;
  onChange: (next: LandingLocale) => void;
  bnLabel: string;
  enLabel: string;
}) {
  return (
    <div
      className="inline-flex overflow-hidden rounded-full border border-[#c5d4e4] bg-white p-0.5 text-xs font-bold shadow-xs"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => onChange('bn')}
        className={cn(
          'rounded-full px-3 py-1.5 transition',
          locale === 'bn' ? 'bg-[#0a2f5b] text-white' : 'bg-transparent text-slate-500 hover:text-[#0a2f5b]',
        )}
      >
        {bnLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange('en')}
        className={cn(
          'rounded-full px-3 py-1.5 transition',
          locale === 'en' ? 'bg-[#0a2f5b] text-white' : 'bg-transparent text-slate-500 hover:text-[#0a2f5b]',
        )}
      >
        {enLabel}
      </button>
    </div>
  );
}

export function PublicLanding() {
  const [locale, setLocale] = useState<LandingLocale>('en');
  const t = useMemo(() => landingCopy(locale), [locale]);

  useEffect(() => {
    setLocale(readLandingLocale());
  }, []);

  function changeLocale(next: LandingLocale) {
    setLocale(next);
    writeLandingLocale(next);
  }

  const nav = [
    { href: LOGIN, label: t.navCourse },
    { href: LOGIN, label: t.navRules },
    { href: LOGIN, label: t.navExam },
    { href: LOGIN, label: t.navSubscription },
  ] as const;

  const features = [
    { icon: GraduationCap, title: t.featPrepTitle, text: t.featPrepText },
    { icon: BookOpen, title: t.featRulesTitle, text: t.featRulesText },
    { icon: Video, title: t.featLiveTitle, text: t.featLiveText },
    { icon: Calculator, title: t.featCalcTitle, text: t.featCalcText },
  ] as const;

  const cards = [
    { icon: GraduationCap, title: t.cardCourseTitle, text: t.cardCourseText },
    { icon: ClipboardCheck, title: t.cardExamTitle, text: t.cardExamText },
    { icon: Video, title: t.cardLiveTitle, text: t.cardLiveText },
    { icon: Calculator, title: t.cardCalcTitle, text: t.cardCalcText },
  ] as const;

  return (
    <div className="min-h-screen bg-[#f4f9fd] text-[#0a2f5b]">
      <header className="sticky top-0 z-20 border-b border-[#d7e4ee] bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0">
            <BrandMark />
          </Link>

          <nav className="ml-2 hidden items-center gap-6 text-sm font-semibold text-[#0a2f5b] lg:flex">
            {nav.map((item) => (
              <a key={item.label} href={item.href} className="transition hover:text-[#1566b8]">
                {item.label}
              </a>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-2.5">
            <LangToggle locale={locale} onChange={changeLocale} bnLabel={t.langBn} enLabel={t.langEn} />
            {/* Plain anchors so Login still works if LAN/dev JS is blocked. */}
            <a
              href={LOGIN}
              className="rounded-lg border border-[#1566b8] bg-white px-3.5 py-2 text-sm font-semibold text-[#1566b8] transition hover:bg-[#eaf3fc] sm:px-4"
            >
              {t.login}
            </a>
            <a
              href={START}
              className="rounded-lg bg-[#1566b8] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#0f5294] sm:px-4"
            >
              {t.getStarted}
            </a>
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto border-t border-[#edf2f7] px-4 py-2 lg:hidden">
          {nav.map((item) => (
            <a
              key={item.label}
              href={item.href}
              className="shrink-0 rounded-full bg-[#eaf3fc] px-3 py-1.5 text-xs font-semibold text-[#0a2f5b]"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-16">
          <div>
            <p className="inline-flex rounded-full bg-[#0a2f5b] px-3.5 py-1 text-xs font-semibold text-white">
              {t.heroBadge}
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">{t.heroTitle}</h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">{t.heroBody}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href={START}
                className="rounded-lg bg-[#1566b8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f5294]"
              >
                {t.heroCta}
              </a>
              <a
                href={LOGIN}
                className="rounded-lg border border-[#1566b8] bg-white px-5 py-3 text-sm font-semibold text-[#1566b8] hover:bg-[#eaf3fc]"
              >
                {t.heroSecondary}
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-500">{t.heroNote}</p>
          </div>

          <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1566b8]">{t.panelTitle}</p>
            <ul className="mt-4 space-y-4">
              {features.map((item) => (
                <li key={item.title} className="flex gap-3.5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#eaf3fc] text-[#1566b8]">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block font-bold text-[#0a2f5b]">{item.title}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-slate-600">{item.text}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="features" className="border-t border-[#d7e4ee] bg-white">
          <div className="mx-auto grid max-w-6xl gap-4 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {cards.map((card) => (
              <a
                key={card.title}
                href={LOGIN}
                className="rounded-2xl border border-[#d7e4ee] bg-[#f4f9fd] p-5 transition hover:border-[#1566b8] hover:bg-white"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#1566b8] shadow-2xs">
                  <card.icon className="h-4 w-4" />
                </span>
                <p className="mt-3 font-bold text-[#0a2f5b]">{card.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{card.text}</p>
              </a>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-[#0a2f5b] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <BrandMark tone="white" />
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/90">
            <a href={LOGIN} className="hover:text-white">
              {t.footerLogin}
            </a>
            {WEB_REGISTRATION_OPEN ? (
              <a href="/register" className="hover:text-white">
                {t.footerRegister}
              </a>
            ) : null}
          </nav>
        </div>
        <div className="border-t border-white/15">
          <p className="mx-auto max-w-6xl px-4 py-3 text-xs text-white/75 sm:px-6">{t.footerNote}</p>
        </div>
      </footer>
    </div>
  );
}
