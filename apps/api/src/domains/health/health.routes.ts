import { Router } from 'express';
import mongoose from 'mongoose';
import { getZoomLiveVideoStatus } from '../live-stream/zoom-meeting.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const zoom = getZoomLiveVideoStatus();
  res.json({
    data: {
      status: 'ok',
      service: 'ibas-api',
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      zoom_video: zoom,
      timestamp: new Date().toISOString(),
    },
  });
});
