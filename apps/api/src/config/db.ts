import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../shared/logger.js';

export async function connectDb(): Promise<void> {
  // Avoid SRV lookup failures on some Windows/DNS setups
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');

  mongoose.set('strictQuery', true);
  await mongoose.connect(env.MONGODB_URI);
  logger.info('MongoDB connected');
}

export async function disconnectDb(): Promise<void> {
  await mongoose.disconnect();
  logger.info('MongoDB disconnected');
}
