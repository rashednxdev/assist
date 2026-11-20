import { Check } from 'lucide-react';
import { BrandMark } from '@/components/brand/brand-mark';

const POINTS = [
  'মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন',
  'আপনার আগের কোর্স ও কেনা সুবিধা একই নম্বরে ফিরে আসবে',
  'নতুন নিবন্ধন ও পাসওয়ার্ড রিসেটে ৬ সংখ্যার কোড যায়',
];

/** Navy panel used by login, registration, and password reset. */
export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[#f4f9fd]">
      <aside className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[#0a2f5b] px-12 py-10 text-white lg:flex">
        <BrandMark tone="white" />
        <div>
          <h1 className="max-w-md text-4xl font-bold leading-tight">প্রশিক্ষণ ও জ্ঞান অর্জন, এক জায়গায়</h1>
          <ul className="mt-8 space-y-3 text-sm text-white/90">
            {POINTS.map((point) => (
              <li key={point} className="flex items-start gap-2">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#7dcea0]" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex items-end gap-3">
          <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-[#1566b8]">
            <div className="h-14 w-14 rounded-full bg-[#7eb6ea]" />
          </div>
          <div className="h-24 w-16 rounded-2xl bg-[#2aabb8]" />
          <div className="h-16 w-16 rounded-2xl bg-[#d7e4ee]" />
        </div>
      </aside>
      <main className="flex flex-1 items-center justify-center px-4 py-10">{children}</main>
    </div>
  );
}
