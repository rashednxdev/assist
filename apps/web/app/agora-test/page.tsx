'use client';

import { useCallback, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { isGatewayJoinError, joinAgoraChannel } from '@/lib/agora-join-client';

type AgoraTestPayload = {
  app_id: string;
  channel: string;
  uid: number;
  token: string | null;
  demo_url?: string;
  hint?: string;
};

type HealthLiveVideo = {
  configured: boolean;
  valid: boolean;
  uses_token: boolean;
  certificate_on_server?: boolean;
  app_id_prefix?: string;
  issue?: string;
  warning?: string;
};

export default function AgoraTestPage() {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthLiveVideo | null>(null);
  const [payload, setPayload] = useState<AgoraTestPayload | null>(null);

  const runTest = useCallback(async () => {
    setBusy(true);
    setStatus('Checking API…');
    setHealth(null);
    setPayload(null);

    let client: Awaited<ReturnType<typeof joinAgoraChannel>> | null = null;
    try {
      const healthRes = await fetch('/api/proxy/v1/health');
      const healthJson = (await healthRes.json()) as { data?: { live_video?: HealthLiveVideo } };
      const liveVideo = healthJson.data?.live_video ?? null;
      setHealth(liveVideo);

      if (!liveVideo?.uses_token) {
        throw new Error('API is not using Agora tokens. Set AGORA_APP_CERTIFICATE on Render and redeploy API.');
      }

      setStatus('Fetching test token…');
      const testRes = await fetch('/api/proxy/v1/health/agora-test');
      const testJson = (await testRes.json()) as { data?: AgoraTestPayload; error?: { message?: string } };
      if (!testRes.ok || !testJson.data?.token) {
        throw new Error(testJson.error?.message ?? 'Could not load agora-test from API');
      }

      const sample = testJson.data;
      const token = sample.token;
      if (!token) {
        throw new Error('API returned no Agora token');
      }
      setPayload(sample);

      setStatus('Joining Agora channel…');
      client = await joinAgoraChannel({
        appId: sample.app_id,
        channel: sample.channel,
        token,
        uid: sample.uid,
        role: 'host',
      });

      setStatus('Success — Agora credentials work. Live class should work after redeploying web + API.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Test failed';
      if (isGatewayJoinError(raw)) {
        setStatus(
          'Failed — Agora rejected the token. Redeploy API with the latest fix, then retry. ' +
            'Your App ID + Primary Certificate look configured; if it still fails after redeploy, ' +
            'use Agora Console → Generate Temp Token and test at webdemo.agora.io/basicVideoCall. ' +
            'If Console token works but this app fails, contact us. If both fail, try mobile hotspot (network block) or check project is Active in Agora.',
        );
      } else {
        setStatus(raw);
      }
    } finally {
      if (client) {
        try {
          await client.leave();
          client.removeAllListeners();
        } catch {
          // ignore
        }
      }
      setBusy(false);
    }
  }, []);

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Agora live video test</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One-click check: API token → join Agora. No external demo site needed.
        </p>
      </div>

      <Button type="button" disabled={busy} onClick={() => void runTest()}>
        {busy ? 'Testing…' : 'Run Agora test'}
      </Button>

      {health ? (
        <Alert variant={health.valid && health.uses_token ? 'success' : 'error'}>
          <pre className="whitespace-pre-wrap text-xs">{JSON.stringify(health, null, 2)}</pre>
        </Alert>
      ) : null}

      {payload ? (
        <Alert>
          <p className="text-xs text-muted-foreground">
            Test channel: {payload.channel}, uid: {payload.uid}, app: {payload.app_id.slice(0, 8)}…
          </p>
        </Alert>
      ) : null}

      {status ? (
        <Alert variant={status.startsWith('Success') ? 'success' : 'error'}>
          <p className="text-sm">{status}</p>
        </Alert>
      ) : null}

      <section className="rounded-xl border p-4 text-sm space-y-2">
        <h2 className="font-semibold">If test fails</h2>
        <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Open console.agora.io → your project → Manage credentials</li>
          <li>Copy App ID + Primary Certificate into Render → ibas-api only (web does not need Agora env vars)</li>
          <li>Run this test again — when it passes, live class works</li>
        </ol>
      </section>
    </main>
  );
}
