'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BrandMark } from '@/components/brand/brand-mark';
import { AuthSplit } from '@/components/auth/auth-split';
import { PasswordInput } from '@/components/ui/password-input';
import {
  clearAccessToken,
  fetchMe,
  isLoginOtp,
  loginRequest,
  setAccessToken,
  SET_PASSWORD_PATH,
  type LoginSessionData,
} from '@/lib/auth';
import { homePathFor } from '@/lib/salary-only';
import { WEB_REGISTRATION_OPEN } from '@/lib/registration';
import { cn } from '@/lib/utils';

const BD_MOBILE = /^01[3-9]\d{8}$/;

function normalizeBdMobile(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.startsWith('880') && digits.length >= 13) return digits.slice(2, 13);
  if (digits.startsWith('0')) return digits.slice(0, 11);
  if (digits.length <= 10 && /^1[3-9]/.test(digits)) return `0${digits}`.slice(0, 11);
  return digits.slice(0, 11);
}

function safeNextPath(): string | null {
  if (typeof window === 'undefined') return null;
  const next = new URLSearchParams(window.location.search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;
}

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const phoneValid = BD_MOBILE.test(phone);

  async function continueAfterSession(session: LoginSessionData) {
    setAccessToken(session.accessToken);
    if (session.must_change_password) {
      router.replace(SET_PASSWORD_PATH);
      return;
    }
    if (session.user.status === 'pending_verify') {
      router.replace('/register/verify');
      return;
    }
    const next = safeNextPath();
    if (next) {
      router.replace(next);
      return;
    }
    const me = await fetchMe().catch(() => null);
    router.replace(homePathFor(me?.data ?? null));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!phoneValid) {
      setError('নম্বরটি সম্পূর্ণ নয়। ১১ সংখ্যার নম্বর দিন (01XXXXXXXXX)।');
      return;
    }
    if (password.length < 8) {
      setError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await loginRequest(phone, password);
      if (isLoginOtp(res.data)) {
        setError('এই ধাপে কোড লাগবে না। পাসওয়ার্ড দিয়ে আবার লগইন করুন।');
        return;
      }
      await continueAfterSession(res.data);
    } catch (err) {
      clearAccessToken();
      const message = err instanceof Error ? err.message : '';
      setError(/invalid|password/i.test(message) ? 'মোবাইল নম্বর বা পাসওয়ার্ড সঠিক নয়।' : message || 'লগইন হয়নি। আবার চেষ্টা করুন।');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplit>
      <div className="w-full max-w-md rounded-2xl border border-[#d7e3ee] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 lg:hidden">
          <BrandMark />
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <h2 className="text-xl font-bold text-[#0a2f5b]">লগইন করুন</h2>
            <p className="mt-1 text-sm text-slate-500">মোবাইল নম্বর ও পাসওয়ার্ড দিন।</p>
          </div>
          <div>
            <label htmlFor="mobile" className="text-sm font-semibold text-[#0a2f5b]">
              মোবাইল নম্বর
            </label>
            <input
              id="mobile"
              inputMode="numeric"
              autoComplete="tel"
              value={phone}
              placeholder="01XXXXXXXXX"
              maxLength={11}
              onChange={(e) => {
                setPhone(normalizeBdMobile(e.target.value));
                setError('');
              }}
              className={cn(
                'mt-2 h-11 w-full rounded-lg border px-3 text-sm outline-none',
                error && !phoneValid ? 'border-red-500' : 'border-[#c5d4e4]',
              )}
            />
            {phone.length > 0 && !phoneValid ? (
              <p className="mt-2 text-sm text-red-600">নম্বরটি সম্পূর্ণ নয়। ১১ সংখ্যার নম্বর দিন (01XXXXXXXXX)।</p>
            ) : (
              <p className="mt-2 text-xs text-slate-500">১১ সংখ্যার মোবাইল নম্বর দিন, যেমন 017XXXXXXXX।</p>
            )}
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-semibold text-[#0a2f5b]">
                পাসওয়ার্ড
              </label>
              <Link href="/forgot-password" className="text-sm font-semibold text-[#1566b8]">
                পাসওয়ার্ড ভুলে গেছেন?
              </Link>
            </div>
            <div className="mt-2">
              <PasswordInput
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={loading || !phoneValid || password.length < 8}
            className="h-11 w-full rounded-lg bg-[#1566b8] text-sm font-semibold text-white disabled:bg-[#d7e4ee] disabled:text-[#8aa0b5]"
          >
            {loading ? 'প্রবেশ হচ্ছে…' : 'লগইন'}
          </button>
        </form>
        {WEB_REGISTRATION_OPEN ? (
          <p className="mt-6 text-center text-sm text-slate-500">
            নতুন ব্যবহারকারী?{' '}
            <Link href="/register" className="font-semibold text-[#1566b8]">
              নিবন্ধন করুন
            </Link>
            । নিবন্ধনে একটি কোড যাবে।
          </p>
        ) : null}
      </div>
    </AuthSplit>
  );
}
