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
      live_video: agora,
      timestamp: new Date().toISOString(),
    },
  });
});
