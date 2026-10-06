'use client';

import { useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BENEFITS = [
  'SDO, DDO কর্তৃক সঠিক বিল প্রস্তুত;',
  'নির্ধারিত ফরম্যট বিধায় সহজে নিরীক্ষা যোগ্য;',
  'প্রস্তুতকৃত টি.আর ফরম-১৩ ও টি.আর. ফরম-১৫ Summary sheet সহ;',
  'কর্মচারীদের ক্ষেত্রে ব্যাচ ভিত্তিক বিল প্রস্তুত;',
];

export function LoginNoticeDialog() {
  const [open, setOpen] = useState(true);
  if (!open) return null;
  const close = () => setOpen(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="login-notice-title">
      <div className="absolute inset-0 bg-slate-900/60" aria-hidden="true" />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 bg-gradient-to-br from-red-600 via-rose-600 to-red-900 px-5 py-3 text-white">
          <span id="login-notice-title" className="flex items-center gap-2 text-sm font-bold">
            <BellRing className="h-5 w-5" />
            বিজ্ঞপ্তি
          </span>
          <button type="button" onClick={close} className="rounded-md p-1 hover:bg-white/15" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-5 px-5 py-6 text-center">
          <p lang="bn" className="text-lg font-bold leading-relaxed text-red-800 sm:text-xl">
            হিসাবরক্ষণ অফিসে প্রেরণের জন্য বকেয়া বিলের হিসাবসহ টিআর-১৩ বা টিআর-১৫ ফর্ম ডাউনলোড করুন।
          </p>
          <div lang="bn" className="rounded-xl border border-red-100 bg-rose-50/70 px-4 py-3 text-left">
            <p className="text-base font-bold text-red-800">সুবিধা</p>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm font-medium leading-relaxed text-slate-800 marker:text-red-600">
              {BENEFITS.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </div>
          <Button type="button" onClick={close} className="min-w-32 bg-red-600 shadow-sm hover:bg-red-700" autoFocus>
            OK
          </Button>
        </div>
      </div>
    </div>
  );
}
