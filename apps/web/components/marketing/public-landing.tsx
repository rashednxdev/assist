import Link from 'next/link';
import { BookOpen, Calculator, ClipboardCheck, GraduationCap, Video } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';
import { WEB_REGISTRATION_OPEN } from '@/lib/registration';

const FEATURES = [
  {
    icon: GraduationCap,
    title: 'বিষয়ভিত্তিক পরীক্ষা প্রস্তুতি',
    text: 'প্রতিটি বিষয়ের বই, লিখিত প্রশ্নব্যাংক, অধ্যায়ভিত্তিক MCQ ও বিগত প্রশ্ন সেট এক জায়গায়।',
  },
  {
    icon: BookOpen,
    title: 'রুলস ও পরিপত্র লাইব্রেরি',
    text: 'সার্ভিস ও ফিন্যান্সিয়াল রুলস, আদেশ, এসআরও এবং গেজেটের নির্ভরযোগ্য রেফারেন্স।',
  },
  {
    icon: Video,
    title: 'লাইভ ক্লাস ও ম্যারাথন রিভিউ',
    text: 'নির্ধারিত সূচি অনুযায়ী লাইভ ক্লাস ও রেকর্ডিং। ফ্রি ক্লাসগুলো সবার জন্য উন্মুক্ত।',
  },
  {
    icon: Calculator,
    title: 'বেতন, পেনশন ও যোগদানকাল ক্যালকুলেটর',
    text: 'টি.আর. ফরম বকেয়া বিল, পেনশন-গ্র্যাচুইটি ও যোগদানকালের নির্ভুল হিসাব।',
  },
] as const;

export function PublicLanding() {
  return (
    <div className="min-h-screen bg-[#f4f9fd] text-[#0a2f5b]">
      <header className="sticky top-0 z-20 border-b border-[#d7e4ee] bg-white">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="shrink-0">
            <BrandMark />
          </Link>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-[#0a2f5b] lg:flex">
            <a href="#features" className="hover:text-[#1566b8]">পরীক্ষা প্রস্তুতি</a>
            <a href="#features" className="hover:text-[#1566b8]">রুলস লাইব্রেরি</a>
            <a href="#features" className="hover:text-[#1566b8]">লাইভ ক্লাস</a>
            <a href="#features" className="hover:text-[#1566b8]">ক্যালকুলেটর</a>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-xl border border-[#1566b8] bg-white px-4 py-2 text-sm font-semibold text-[#1566b8] hover:bg-[#eaf3fc]"
            >
              লগইন
            </Link>
            <Link
              href={WEB_REGISTRATION_OPEN ? '/register' : '/login'}
              className="rounded-xl bg-[#1566b8] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f5294]"
            >
              শুরু করুন
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:py-16">
          <div>
            <p className="inline-flex rounded-full bg-[#0a2f5b] px-3.5 py-1 text-xs font-semibold text-white">
              সরকারি কর্মকর্তা ও পরীক্ষার্থীদের জন্য
            </p>
            <h1 className="mt-3 text-3xl font-bold leading-tight sm:text-5xl">
              প্রশিক্ষণ ও জ্ঞান অর্জন, এক জায়গায়
            </h1>
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600 sm:text-lg">
              পদোন্নতি ও বিভাগীয় পরীক্ষার বিষয়ভিত্তিক প্রস্তুতি, বিধি-বিধানের লাইব্রেরি, লাইভ ক্লাস এবং চাকরি ক্যালকুলেটর — সহজ বাংলায়, ফোনে বা কম্পিউটারে।
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href={WEB_REGISTRATION_OPEN ? '/register' : '/login'}
                className="rounded-xl bg-[#1566b8] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0f5294]"
              >
                শুরু করুন
              </Link>
              <a
                href="#features"
                className="rounded-xl border border-[#1566b8] bg-white px-5 py-3 text-sm font-semibold text-[#1566b8] hover:bg-[#eaf3fc]"
              >
                বিস্তারিত দেখুন
              </a>
            </div>
            <p className="mt-4 text-sm text-slate-500">মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে দ্রুত সাইন ইন</p>
          </div>

          <div className="rounded-2xl border border-[#d7e4ee] bg-white p-6 shadow-xs">
            <p className="text-xs font-bold uppercase tracking-wider text-[#1566b8]">যা যা পাবেন</p>
            <ul className="mt-4 space-y-4">
              {FEATURES.map((item) => (
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
            {[
              {
                icon: GraduationCap,
                title: 'বিষয়ভিত্তিক কোর্স',
                text: 'এনরোল করা প্রতিটি বিষয়ের বই, লিখিত প্রশ্ন (পঠিত/অপঠিত হিসাবসহ) ও অধ্যায়ভিত্তিক MCQ অনুশীলন।',
              },
              {
                icon: ClipboardCheck,
                title: 'মডেল টেস্ট ও বিগত সেট',
                text: 'সময় ধরে পূর্ণাঙ্গ মডেল টেস্ট, বিগত বছরের প্রশ্নপত্র এবং ভুল প্রশ্নের আলাদা রি-টেস্ট।',
              },
              {
                icon: Video,
                title: 'লাইভ ক্লাস সময়সূচি',
                text: 'সকল আসন্ন ফ্রি ও পেইড লাইভ ক্লাসের সূচি, জুম সেশন এবং পূর্ববর্তী রেকর্ডিং ও স্লাইড।',
              },
              {
                icon: Calculator,
                title: 'চাকরি ক্যালকুলেটর',
                text: 'বেতন ও টি.আর. ফরম বকেয়া বিল, পেনশন-গ্র্যাচুইটি এবং যোগদানকালের পূর্ণাঙ্গ হিসাব।',
              },
            ].map((card) => (
              <div key={card.title} className="rounded-2xl border border-[#d7e4ee] bg-[#f4f9fd] p-5">
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#1566b8] shadow-2xs">
                  <card.icon className="h-4 w-4" />
                </span>
                <p className="mt-3 font-bold text-[#0a2f5b]">{card.title}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{card.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-[#0a2f5b] text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6">
          <BrandMark tone="white" />
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/90">
            <Link href="/login" className="hover:text-white">
              লগইন
            </Link>
            {WEB_REGISTRATION_OPEN ? (
              <Link href="/register" className="hover:text-white">
                নিবন্ধন
              </Link>
            ) : null}
          </nav>
        </div>
        <div className="border-t border-white/15">
          <p className="mx-auto max-w-6xl px-4 py-3 text-xs text-white/75 sm:px-6">
            Developed by Bitnest Lab · ProAssist একটি অধ্যয়ন-সহায়ক প্ল্যাটফর্ম, দপ্তরের অফিসিয়াল পরামর্শ নয়।
          </p>
        </div>
      </footer>
    </div>
  );
}
