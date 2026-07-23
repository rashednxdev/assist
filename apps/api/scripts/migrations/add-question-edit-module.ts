import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { Module } from '../../src/domains/setup/models/Module.model.js';

/**
 * Registers the QUESTION_EDIT module (mobile "Question update" facility) so admins can grant
 * it from the existing Module access UI. Idempotent upsert — safe to re-run.
 */
async function main() {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);

  await Module.updateOne(
    { code: 'QUESTION_EDIT' },
    {
      $set: {
        code: 'QUESTION_EDIT',
        name_en: 'Question update (mobile)',
        description_en:
          'Update existing questions/answers and move them between draft, quality check, and published from the mobile app — cannot create new questions',
        color: '#B45309',
        sort_order: 22,
        is_active: true,
      },
    },
    { upsert: true },
  );

  console.log('Registered QUESTION_EDIT module.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
