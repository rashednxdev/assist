'use client';

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/alert';

interface Plan {
  id: string;
  name: string;
  code: string;
  description?: string;
  price_bdt: number;
  duration_days: number;
  features: string[];
}

interface Subscription {
  plan: { name: string; code: string; price_bdt: number } | null;
  expires_at: string;
  status: string;
}

export default function SettingsSubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<Subscription | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  function reload() {
    Promise.all([
      apiFetch<{ data: Plan[] }>('/account/subscription/plans'),
      apiFetch<{ data: Subscription | null }>('/account/subscription'),
    ]).then(([p, s]) => {
      setPlans(p.data);
      setCurrent(s.data);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  async function subscribe(planId: string) {
    setBusy(planId);
    setError('');
    try {
      await apiFetch('/account/subscription', {
        method: 'POST',
        body: JSON.stringify({ plan_id: planId }),
      });
      setMessage('Subscription updated (demo — no payment charged)');
      reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Subscription failed');
    } finally {
      setBusy('');
    }
  }

  return (
    <div className="space-y-6">
      {current?.plan && (
        <Alert variant="success">
          Active plan: <strong>{current.plan.name}</strong> until{' '}
          {new Date(current.expires_at).toLocaleDateString()}
        </Alert>
      )}
      {message && <Alert variant="success">{message}</Alert>}
      {error && <Alert variant="error">{error}</Alert>}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const active = current?.plan?.code === plan.code;
          return (
            <Card key={plan.id} className={active ? 'ring-2 ring-primary' : ''}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {active && <Badge variant="success">Current</Badge>}
                </div>
                <p className="text-2xl font-bold">
                  {plan.price_bdt === 0 ? 'Free' : `৳${plan.price_bdt}`}
                  {plan.price_bdt > 0 && (
                    <span className="text-sm font-normal text-muted"> / {plan.duration_days} days</span>
                  )}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted">{plan.description}</p>
                <ul className="space-y-2 text-sm">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <Check className="h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full"
                  variant={active ? 'outline' : 'default'}
                  disabled={active || busy === plan.id}
                  onClick={() => subscribe(plan.id)}
                >
                  {active ? 'Current plan' : busy === plan.id ? 'Processing…' : 'Select plan'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
