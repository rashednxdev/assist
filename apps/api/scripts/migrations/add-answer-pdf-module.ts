import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { Module } from '../../src/domains/setup/models/Module.model.js';

/**
 * Registers the ANSWER_PDF module so admins can grant PDF answer download
 * from Question Bank / Answer Reading History. Idempotent upsert.
 */
async function main() {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);

  await Module.updateOne(
    { code: 'ANSWER_PDF' },
    {
      $set: {
        code: 'ANSWER_PDF',
        name_en: 'Answer PDF download',
        description_en:
          'Download question answers as PDF from Question Bank and Answer Reading History (A4 or Pocket 5″×8″, landscape)',
        color: '#1D4ED8',
        sort_order: 28,
        is_active: true,
      },
    },
    { upsert: true },
  );

  console.log('Registered ANSWER_PDF module.');
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
