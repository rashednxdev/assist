'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Phone, ShieldCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { getAccessToken, fetchMe } from '@/lib/auth';
import { AuthBrandPanel } from '@/components/auth/auth-brand-panel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/form-field';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface DemoInfo {
  email: string;
  phone: string;
  emailOtp: string;
  phoneOtp: string;
}

export default function RegisterVerifyPage() {
  const router = useRouter();
  const [demo, setDemo] = useState<DemoInfo | null>(null);
  const [emailCode, setEmailCode] = useState('');
  const [phoneCode, setPhoneCode] = useState('');
  const [emailDone, setEmailDone] = useState(false);
  const [phoneDone, setPhoneDone] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace('/register');
      return;
    }
    const raw = sessionStorage.getItem('ibas_register_demo');
    if (raw) setDemo(JSON.parse(raw) as DemoInfo);
    fetchMe()
      .then((r) => {
        setEmailDone(r.data.email_verified);
        setPhoneDone(r.data.phone_verified);
        if (r.data.status === 'active' && r.data.is_verified) {
          sessionStorage.removeItem('ibas_register_demo');
          router.replace('/dashboard');
        }
      })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function verify(channel: 'email' | 'phone', code: string) {
    setError('');
    setBusy(channel);
    try {
      const res = await apiFetch<{ data: { activated: boolean } }>('/account/verify', {
        method: 'POST',
        body: JSON.stringify({ channel, code }),
      });
      if (channel === 'email') setEmailDone(true);
      else setPhoneDone(true);
      setMessage(`${channel === 'email' ? 'Email' : 'Phone'} verified successfully`);
      if (res.data.activated) {
        sessionStorage.removeItem('ibas_register_demo');
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setBusy('');
    }
  }

  async function resend(channel: 'email' | 'phone') {
    setError('');
    setBusy(`resend-${channel}`);
    try {
      const res = await apiFetch<{ data: { demoCode: string } }>('/account/verify/resend', {
        method: 'POST',
        body: JSON.stringify({ channel }),
      });
      if (demo) {
        const updated = {
          ...demo,
          ...(channel === 'email' ? { emailOtp: res.data.demoCode } : { phoneOtp: res.data.demoCode }),
        };
        setDemo(updated);
        sessionStorage.setItem('ibas_register_demo', JSON.stringify(updated));
      }
      setMessage(`New demo ${channel} code sent`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resend');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <AuthBrandPanel />
      <div className="flex flex-1 items-center justify-center bg-background p-4 sm:p-8">
        <Card className="w-full max-w-lg border-0 shadow-lg sm:border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Verify your account
            </CardTitle>
            <CardDescription>
              Demo mode: verification codes are shown below. In production, codes will be sent to your email and SMS.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {message && <Alert variant="success">{message}</Alert>}
            {error && <Alert variant="error">{error}</Alert>}

            {demo && (
              <div className="rounded-lg border border-dashed border-primary/40 bg-primary-muted/50 p-4 text-sm">
                <p className="font-semibold text-primary-dark">Demo verification codes</p>
                <p className="mt-2">
                  Email ({demo.email}): <Badge variant="secondary">{demo.emailOtp}</Badge>
                </p>
                <p className="mt-1">
                  Phone ({demo.phone}): <Badge variant="secondary">{demo.phoneOtp}</Badge>
                </p>
              </div>
            )}

            <div className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 font-medium">
                <Mail className="h-4 w-4" /> Email verification
                {emailDone && <Badge variant="success">Done</Badge>}
              </div>
              {!emailDone && (
                <>
                  <FormField label="Email code" htmlFor="email-code">
                    <Input
                      id="email-code"
                      value={emailCode}
                      onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      maxLength={6}
                    />
                  </FormField>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={emailCode.length !== 6 || busy === 'email'}
                      onClick={() => verify('email', emailCode)}
                    >
                      Verify email
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === 'resend-email'}
                      onClick={() => resend('email')}
                    >
                      Resend
                    </Button>
                  </div>
                </>
              )}
            </div>

            <div className="space-y-3 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 font-medium">
                <Phone className="h-4 w-4" /> Phone verification
                {phoneDone && <Badge variant="success">Done</Badge>}
              </div>
              {!phoneDone && (
                <>
                  <FormField label="SMS code" htmlFor="phone-code">
                    <Input
                      id="phone-code"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6-digit code"
                      maxLength={6}
                    />
                  </FormField>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={phoneCode.length !== 6 || busy === 'phone'}
                      onClick={() => verify('phone', phoneCode)}
                    >
                      Verify phone
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy === 'resend-phone'}
                      onClick={() => resend('phone')}
                    >
                      Resend
                    </Button>
                  </div>
                </>
              )}
            </div>

            {emailDone && phoneDone && (
              <Button className="w-full" asChild>
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
