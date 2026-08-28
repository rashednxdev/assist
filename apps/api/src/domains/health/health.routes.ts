import { Router } from 'express';
import mongoose from 'mongoose';
import { getAgoraLiveVideoStatus } from '../live-stream/agora-token.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const agora = getAgoraLiveVideoStatus();
  res.json({
    data: {
      status: 'ok',
      service: 'ibas-api',
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      live_video: {
        configured: agora.configured,
        valid: agora.valid,
        ...(agora.app_id_prefix ? { app_id_prefix: agora.app_id_prefix } : {}),
        ...(agora.issue ? { issue: agora.issue } : {}),
      },
      timestamp: new Date().toISOString(),
    },
  });
});
