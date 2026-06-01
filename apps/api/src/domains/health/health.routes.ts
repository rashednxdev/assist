import { Router } from 'express';
import mongoose from 'mongoose';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({
    data: {
      status: 'ok',
      service: 'ibas-api',
      mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    },
  });
});
