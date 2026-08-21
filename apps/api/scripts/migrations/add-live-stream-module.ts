import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { Module } from '../../src/domains/setup/models/Module.model.js';

/** Registers LIVE_STREAM so admins can grant the Live class module. Idempotent. */
async function main() {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);

  await Module.updateOne(
    { code: 'LIVE_STREAM' },
    {
      $set: {
        code: 'LIVE_STREAM',
        name_en: 'Live class',
        description_en:
          'One-to-many live video sessions (Agora) — admins schedule; invited users can join',
        color: '#BE185D',
        sort_order: 29,
        is_active: true,
      },
    },
    { upsert: true },
  );

  console.log('Registered LIVE_STREAM module.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
