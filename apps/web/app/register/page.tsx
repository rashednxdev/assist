'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { AuthSplit } from '@/components/auth/auth-split';
import { BrandMark } from '@/components/brand/brand-mark';
import { registerRequest, resendRegisterRequest, setAccessToken, verifyRegisterRequest } from '@/lib/auth';
import { WEB_REGISTRATION_OPEN } from '@/lib/registration';
import { LEARNING_HOME } from '@/lib/learning-access';
import { toBanglaDigits } from '@/lib/bangla-format';

const OTP_LENGTH = 6;

function emptyDigits(): string[] {
  return Array.from({ length: OTP_LENGTH }, () => '');
}

function formatTimer(sec: number): string {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return toBanglaDigits(`${m}:${s}`);
}

function OtpSquares({
  digits,
  onChange,
  disabled,
}: {
  digits: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  function focusAt(index: number) {
    refs.current[Math.max(0, Math.min(index, OTP_LENGTH - 1))]?.focus();
  }

  function writeFrom(index: number, raw: string) {
    const incoming = raw.replace(/\D/g, '');
    if (!incoming) {
      const next = digits.slice();
      next[index] = '';
      onChange(next);
      return;
    }
    const next = digits.slice();
    incoming
      .slice(0, OTP_LENGTH - index)
      .split('')
      .forEach((digit, offset) => {
        next[index + offset] = digit;
      });
    onChange(next);
    focusAt(index + incoming.length);
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-2.5" role="group" aria-label="যাচাইকরণ কোড">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          value={digit}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`ডিজিট ${index + 1}`}
          className="h-13 w-11 rounded-xl border-2 border-[#d7e4ee] bg-[#f4f9fd] text-center text-xl font-bold text-[#0a2f5b] outline-none transition focus:border-[#1566b8] focus:bg-white focus:ring-2 focus:ring-[#1566b8]/20 disabled:opacity-60 sm:h-14 sm:w-12"
          onChange={(e) => writeFrom(index, e.target.value)}
          onFocus={(e) => e.target.select()}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text');
            if (!/\d/.test(text)) return;
            e.preventDefault();
            writeFrom(index, text);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (digits[index]) {
                const next = digits.slice();
                next[index] = '';
                onChange(next);
                return;
              }
              if (index > 0) {
                const next = digits.slice();
                next[index - 1] = '';
                onChange(next);
                focusAt(index - 1);
              }
              return;
            }
            if (e.key === 'ArrowLeft') focusAt(index - 1);
            if (e.key === 'ArrowRight') focusAt(index + 1);
          }}
        />
      ))}
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();

  useEffect(() => {
    if (!WEB_REGISTRATION_OPEN) router.replace('/login');
  }, [router]);

  return WEB_REGISTRATION_OPEN ? <RegisterForm /> : null;
}

function RegisterForm() {
  const router = useRouter();
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [form, setForm] = useState({
    full_name_en: '',
    email: '',
    phone: '',
    password: '',
    confirm_password: '',
  });
  const [acceptedTerms, setAcceptedTerms] = useState(true);
  const [phoneHint, setPhoneHint] = useState('');
  const [digits, setDigits] = useState(emptyDigits);
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const checkedCode = useRef('');

  const code = digits.join('');

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  useEffect(() => {
    if (step !== 'otp' || loading || code.length !== OTP_LENGTH || checkedCode.current === code) return;
    checkedCode.current = code;
    void checkCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('দুইটি পাসওয়ার্ড এক হয়নি');
      return;
    }
    if (!acceptedTerms) {
      setError('নিবন্ধন সম্পন্ন করতে সম্মতি টিক দিন।');
      return;
    }
    setLoading(true);
    try {
      const res = await registerRequest({
        full_name_en: form.full_name_en.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
        confirm_password: form.confirm_password,
        user_type: 'applicant',
        accept_terms: acceptedTerms,
      });
      setPhoneHint(res.data.phone_hint);
      setDigits(emptyDigits());
      checkedCode.current = '';
      setStep('otp');
      setResendIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'নিবন্ধন সম্পন্ন করা যায়নি');
    } finally {
      setLoading(false);
    }
  }

  async function checkCode(nextCode: string) {
    setLoading(true);
    setError('');
    try {
      const res = await verifyRegisterRequest(form.phone.trim(), nextCode);
      setAccessToken(res.data.tokens.accessToken);
      router.replace(LEARNING_HOME);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'কোডটি মেলেনি। অনুগ্রহ করে আবার চেষ্টা করুন।');
      setDigits(emptyDigits());
      checkedCode.current = '';
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setLoading(true);
    setError('');
    try {
      const res = await resendRegisterRequest(form.phone.trim());
      setPhoneHint(res.data.phone_hint);
      setDigits(emptyDigits());
      checkedCode.current = '';
      setResendIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'নতুন কোড পাঠানো যায়নি।');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthSplit>
      <div className="w-full max-w-[460px] rounded-2xl border border-[#d7e4ee] bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-4 lg:hidden">
          <BrandMark />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-[#0a2f5b]">
          {step === 'otp' ? 'কোড লিখুন' : 'নতুন অ্যাকাউন্ট খুলুন'}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {step === 'otp'
            ? 'আপনার মোবাইল নম্বর যাচাই করলে অ্যাকাউন্ট চালু হয়ে যাবে।'
            : 'তথ্য পূরণ করলে মোবাইলে একবারের জন্য ৬ সংখ্যার যাচাইকরণ কোড যাবে।'}
        </p>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            <FormField label="পূর্ণ নাম (ইংরেজিতে)" htmlFor="name-en" required>
              <Input
                id="name-en"
                value={form.full_name_en}
                onChange={(e) => setForm((f) => ({ ...f, full_name_en: e.target.value }))}
                placeholder="যেমন: Mohammad Karim"
                required
                minLength={2}
                className="h-11 rounded-xl border-[#d7e4ee] bg-[#f4f9fd] focus:bg-white"
              />
            </FormField>

            <FormField label="মোবাইল নম্বর" htmlFor="phone" required hint="১১ সংখ্যার সচল নম্বর (01XXXXXXXXX)">
              <Input
                id="phone"
                inputMode="numeric"
                autoComplete="tel"
                value={form.phone}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '');
                  const next =
                    digits.startsWith('880') && digits.length >= 13
                      ? digits.slice(2, 13)
                      : digits.startsWith('0')
                        ? digits.slice(0, 11)
                        : digits.length <= 10 && /^1[3-9]/.test(digits)
                          ? `0${digits}`.slice(0, 11)
                          : digits.slice(0, 11);
                  setForm((f) => ({ ...f, phone: next }));
                }}
                placeholder="01XXXXXXXXX"
                required
                maxLength={11}
                pattern="01[3-9][0-9]{8}"
                className="h-11 rounded-xl border-[#d7e4ee] bg-[#f4f9fd] focus:bg-white"
              />
            </FormField>

            <FormField label="ইমেইল ঠিকানা" htmlFor="email" required>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                required
                className="h-11 rounded-xl border-[#d7e4ee] bg-[#f4f9fd] focus:bg-white"
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="পাসওয়ার্ড" htmlFor="password" required>
                <PasswordInput
                  id="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-11 rounded-xl border-[#d7e4ee] bg-[#f4f9fd] focus:bg-white"
                />
              </FormField>
              <FormField label="পাসওয়ার্ড নিশ্চিত করুন" htmlFor="confirm" required>
                <PasswordInput
                  id="confirm"
                  value={form.confirm_password}
                  onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className="h-11 rounded-xl border-[#d7e4ee] bg-[#f4f9fd] focus:bg-white"
                />
              </FormField>
            </div>

            <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="mt-0.5 accent-[#1566b8]"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
              />
              <span>আমি ProAssist প্ল্যাটফর্মে নিবন্ধন করতে সম্মতি প্রদান করছি।</span>
            </label>

            {error ? <Alert variant="error">{error}</Alert> : null}

            <Button
              type="submit"
              className="h-11 w-full rounded-xl bg-[#1566b8] text-base font-semibold text-white hover:bg-[#0f5294]"
              disabled={loading || !acceptedTerms}
            >
              {loading ? 'কোড পাঠানো হচ্ছে…' : 'অ্যাকাউন্ট খুলুন'}
            </Button>

            <p className="text-center text-sm text-slate-600">
              আগে থেকেই অ্যাকাউন্ট আছে?{' '}
              <Link href="/login" className="font-semibold text-[#1566b8] hover:underline">
                সাইন ইন করুন
              </Link>
            </p>
          </form>
        ) : (
          <div className="mt-5 space-y-5">
            <p className="text-sm text-slate-600">
              <span className="font-bold text-[#0a2f5b]">{phoneHint}</span> নম্বরে পাঠানো ৬ সংখ্যার কোডটি লিখুন।
            </p>

            <OtpSquares digits={digits} onChange={setDigits} disabled={loading} />

            {loading ? <p className="text-center text-xs text-slate-500">যাচাই করা হচ্ছে…</p> : null}
            {error ? <Alert variant="error">{error}</Alert> : null}

            <Button
              type="button"
              disabled={loading || code.length !== OTP_LENGTH}
              onClick={() => void checkCode(code)}
              className="h-11 w-full rounded-xl bg-[#1566b8] text-sm font-semibold text-white hover:bg-[#0f5294]"
            >
              যাচাই করুন
            </Button>

            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                className="font-medium text-slate-500 hover:text-[#0a2f5b]"
                onClick={() => {
                  setError('');
                  setStep('form');
                }}
              >
                তথ্য সম্পাদনা করুন
              </button>
              <button
                type="button"
                className="font-semibold text-[#1566b8] hover:underline disabled:text-slate-400 disabled:no-underline"
                disabled={loading || resendIn > 0}
                onClick={() => void resend()}
              >
                {resendIn > 0 ? `${formatTimer(resendIn)} পরে আবার পাঠানো যাবে` : 'আবার কোড পাঠান'}
              </button>
            </div>
          </div>
        )}
      </div>
    </AuthSplit>
  );
}
