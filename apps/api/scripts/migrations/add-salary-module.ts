import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { Module } from '../../src/domains/setup/models/Module.model.js';

/**
 * Registers the SALARY module (Salary On 2026 calculator). Idempotent upsert.
 */
async function main() {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);

  await Module.updateOne(
    { code: 'SALARY' },
    {
      $set: {
        code: 'SALARY',
        name_en: 'Salary On 2026',
        description_en: 'National Pay Scale 2015 to 2026 basic pay conversion',
        color: '#047857',
        sort_order: 29,
        is_active: true,
      },
    },
    { upsert: true },
  );

  console.log('Registered SALARY module.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
