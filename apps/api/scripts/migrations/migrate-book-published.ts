import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { BookInfo } from '../../src/domains/books/models/BookInfo.model.js';

/**
 * Backfill is_published for books created before the Published/Draft facility existed.
 * All pre-existing books were implicitly visible to everyone, so they become published here;
 * only books created after this migration default to draft. Idempotent — only touches
 * documents missing the field.
 */
async function main() {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);

  const result = await BookInfo.updateMany(
    { is_published: { $exists: false } },
    { $set: { is_published: true } },
  );

  console.log(`Backfilled is_published: ${result.modifiedCount} book(s) marked published.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
