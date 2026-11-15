'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { LoginShowcasePanel } from '@/components/auth/login-showcase-panel';
import { registerRequest, resendRegisterRequest, setAccessToken, verifyRegisterRequest } from '@/lib/auth';
import { WEB_REGISTRATION_OPEN } from '@/lib/registration';
import { SALARY_HOME } from '@/lib/learning-access';

const OTP_LENGTH = 6;

function emptyDigits(): string[] {
  return Array.from({ length: OTP_LENGTH }, () => '');
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
    <div className="flex justify-center gap-2 sm:gap-2.5" role="group" aria-label="Verification code">
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
          aria-label={`Digit ${index + 1}`}
          className="h-14 w-11 rounded-lg border-2 border-border bg-white text-center text-xl font-semibold text-foreground shadow-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/25 disabled:opacity-60 sm:h-[3.75rem] sm:w-12"
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
  const [acceptedTerms, setAcceptedTerms] = useState(false);
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
    // The code value is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    if (!acceptedTerms) {
      setError('Please confirm that you want to register.');
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
      setError(err instanceof Error ? err.message : 'Registration failed');
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
      router.replace(SALARY_HOME);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code is not correct.');
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
      setError(err instanceof Error ? err.message : 'Could not send a new code.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <LoginShowcasePanel />
      <div className="flex flex-1 items-center justify-center bg-background p-4 sm:p-8">
        <Card className="w-full max-w-lg border-0 shadow-lg sm:border">
          <CardHeader className="space-y-1 pb-2">
            <div className="mb-2 lg:hidden">
              <Image
                src="/brand/proassist-logo.png"
                alt="ProAssist"
                width={48}
                height={48}
                className="h-12 w-12 rounded-xl"
                priority
              />
            </div>
            <CardTitle className="text-2xl">{step === 'otp' ? 'Enter the code' : 'Create your account'}</CardTitle>
          </CardHeader>
          <CardContent>
            {step === 'form' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="Full name (English)" htmlFor="name-en" required>
                  <Input
                    id="name-en"
                    value={form.full_name_en}
                    onChange={(e) => setForm((f) => ({ ...f, full_name_en: e.target.value }))}
                    required
                    minLength={2}
                  />
                </FormField>
                <FormField label="Mobile" htmlFor="phone" required hint="01XXXXXXXXX">
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="01700000000"
                    required
                    pattern="01[3-9][0-9]{8}"
                  />
                </FormField>
                <FormField label="Email" htmlFor="email" required hint="Used to reset your password if you forget it">
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="you@example.com"
                    required
                  />
                </FormField>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Password" htmlFor="password" required>
                    <PasswordInput
                      id="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </FormField>
                  <FormField label="Confirm password" htmlFor="confirm" required>
                    <PasswordInput
                      id="confirm"
                      value={form.confirm_password}
                      onChange={(e) => setForm((f) => ({ ...f, confirm_password: e.target.value }))}
                      required
                      minLength={8}
                      autoComplete="new-password"
                    />
                  </FormField>
                </div>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                  />
                  <span className="font-medium text-[#b71c1c]">I want to register.</span>
                </label>
                {error && <Alert variant="error">{error}</Alert>}
                <Button type="submit" className="h-11 w-full" disabled={loading || !acceptedTerms}>
                  {loading ? 'Sending code…' : 'Create account'}
                </Button>
                <p className="text-center text-sm text-muted">
                  Already have an account?{' '}
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    Sign in
                  </Link>
                </p>
              </form>
            ) : (
              <div className="space-y-5">
                <p className="text-center text-sm text-muted">
                  A 6-digit code was sent to <span className="font-semibold text-foreground">{phoneHint}</span>. It expires
                  in 15 minutes.
                </p>
                <OtpSquares digits={digits} onChange={setDigits} disabled={loading} />
                {loading ? <p className="text-center text-sm text-muted">Checking the code…</p> : null}
                {error ? <Alert variant="error">{error}</Alert> : null}
                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    className="text-muted hover:underline"
                    onClick={() => {
                      setError('');
                      setStep('form');
                    }}
                  >
                    Edit details
                  </button>
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline disabled:opacity-50"
                    disabled={loading || resendIn > 0}
                    onClick={() => void resend()}
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
