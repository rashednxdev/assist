import { Router } from 'express';
import mongoose from 'mongoose';
import { buildAgoraSampleJoin, getAgoraLiveVideoStatus } from '../live-stream/agora-token.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const agora = getAgoraLiveVideoStatus();
  res.json({
    data: {
      status: 'ok',
      service: 'ibas-api',
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      live_video: agora,
      timestamp: new Date().toISOString(),
    },
  });
});

/** Paste values into https://webdemo.agora.io/basicVideo/index.html to test Agora credentials. */
healthRouter.get('/agora-test', (_req, res) => {
  try {
    const sample = buildAgoraSampleJoin();
    res.json({
      data: {
        app_id: sample.appId,
        channel: 'proassist_credential_test',
        uid: 10_001,
        token: sample.token,
        token_expires_at: sample.expireAt,
        demo_url: 'https://webdemo.agora.io/basicVideo/index.html',
        hint:
          'If the demo also fails, open Agora Console → Project → Config: enable Primary Certificate and copy it exactly into Render AGORA_APP_CERTIFICATE. If certificate is disabled, set AGORA_USE_TOKEN=false on Render.',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agora sample join failed';
    res.status(400).json({ error: { message } });
  }
});
