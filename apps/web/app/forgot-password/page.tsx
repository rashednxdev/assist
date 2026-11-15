'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { LoginShowcasePanel } from '@/components/auth/login-showcase-panel';
import { forgotPasswordRequest, resetPasswordRequest, verifyResetCode } from '@/lib/auth';

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

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<'phone' | 'otp' | 'password'>('phone');
  const [phone, setPhone] = useState('');
  const [phoneHint, setPhoneHint] = useState('');
  const [digits, setDigits] = useState(emptyDigits);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendIn, setResendIn] = useState(0);
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
    // checkCode is recreated each render; the code value is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await forgotPasswordRequest(phone.trim());
      setPhoneHint(data.phone_hint);
      setDigits(emptyDigits());
      checkedCode.current = '';
      setStep('otp');
      setResendIn(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send a reset code.');
    } finally {
      setLoading(false);
    }
  }

  async function checkCode(nextCode: string) {
    setLoading(true);
    setError('');
    try {
      await verifyResetCode(phone.trim(), nextCode);
      setStep('password');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code is not correct.');
      setDigits(emptyDigits());
      checkedCode.current = '';
    } finally {
      setLoading(false);
    }
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await resetPasswordRequest({
        phone: phone.trim(),
        code,
        new_password: password,
        confirm_password: confirm,
      });
      router.replace('/login');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the password.');
    } finally {
      setLoading(false);
    }
  }

  const title = step === 'password' ? 'Choose a new password' : step === 'otp' ? 'Enter the code' : 'Forgot password';

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <LoginShowcasePanel />
      <div className="flex flex-1 items-center justify-center bg-background p-4 sm:p-8">
        <Card className="w-full max-w-md border-0 shadow-lg sm:border">
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-2xl">{title}</CardTitle>
          </CardHeader>
          <CardContent>
            {step === 'phone' ? (
              <form onSubmit={sendCode} className="space-y-5">
                <p className="text-sm text-muted">Enter the mobile number on your account. We will text a 6-digit code.</p>
                <FormField label="Mobile" htmlFor="phone" required>
                  <Input
                    id="phone"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01XXXXXXXXX"
                    pattern="01[3-9][0-9]{8}"
                    required
                    autoFocus
                  />
                </FormField>
                {error ? <Alert variant="error">{error}</Alert> : null}
                <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
                  {loading ? 'Sending…' : 'Send code'}
                </Button>
                <p className="text-center text-sm">
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    Back to sign in
                  </Link>
                </p>
              </form>
            ) : null}

            {step === 'otp' ? (
              <div className="space-y-5">
                <p className="text-center text-sm text-muted">
                  A 6-digit code was sent to <span className="font-semibold text-foreground">{phoneHint}</span>. It expires
                  in 15 minutes.
                </p>
                <OtpSquares digits={digits} onChange={setDigits} disabled={loading} />
                {loading ? <p className="text-center text-sm text-muted">Checking the code…</p> : null}
                {error ? <Alert variant="error">{error}</Alert> : null}
                <div className="flex items-center justify-between text-sm">
                  <Link href="/login" className="text-muted hover:underline">
                    Back to sign in
                  </Link>
                  <button
                    type="button"
                    className="font-medium text-primary hover:underline disabled:opacity-50"
                    disabled={loading || resendIn > 0}
                    onClick={() => void sendCode()}
                  >
                    {resendIn > 0 ? `Resend in ${resendIn}s` : 'Resend code'}
                  </button>
                </div>
              </div>
            ) : null}

            {step === 'password' ? (
              <form onSubmit={handleReset} className="space-y-5">
                <p className="text-sm text-muted">The code is correct. Choose a new password for this account.</p>
                <FormField label="New password" htmlFor="password" required>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                  />
                </FormField>
                <FormField label="Confirm password" htmlFor="confirm" required>
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </FormField>
                {error ? <Alert variant="error">{error}</Alert> : null}
                <Button type="submit" className="h-11 w-full text-base" disabled={loading || password.length < 8}>
                  {loading ? 'Saving…' : 'Save password'}
                </Button>
                <p className="text-center text-sm">
                  <Link href="/login" className="font-medium text-primary hover:underline">
                    Back to sign in
                  </Link>
                </p>
              </form>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
