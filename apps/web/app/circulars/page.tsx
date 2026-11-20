'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { Archive } from 'lucide-react';
import { CircularBrowser } from '@/components/circulars/circular-browser';

export default function CircularsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a2f5b] sm:text-3xl">সর্বশেষ সংবাদ ও পরিপত্র</h1>
          <p className="mt-1 text-sm text-slate-600">
            সরকারি পরিপত্র, আদেশ, এসআরও, গেজেট ও দপ্তর আদেশ — স্মারক নম্বর, বিষয়, মন্ত্রণালয় বা ট্যাগ দিয়ে খুঁজুন।
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/books?tab=circulars"
            className="rounded-xl border border-[#d7e4ee] bg-white px-3.5 py-2 text-xs font-semibold text-[#0a2f5b] hover:bg-[#eaf3fc]"
          >
            বই ও রেফারেন্স
          </Link>
          <Link
            href="/policy"
            className="rounded-xl border border-[#d7e4ee] bg-white px-3.5 py-2 text-xs font-semibold text-[#1566b8] hover:bg-[#eaf3fc]"
          >
            নীতিমালা সংকলন
          </Link>
        </div>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Archive className="h-4 w-4" /> পরিপত্র তালিকা লোড হচ্ছে…
          </div>
        }
      >
        <CircularBrowser />
      </Suspense>
    </div>
  );
}
