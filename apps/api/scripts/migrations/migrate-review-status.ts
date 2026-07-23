import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { Question } from '../../src/domains/questions/models/Question.model.js';

/**
 * Backfill review_status for questions created before the draft -> quality_check -> published
 * workflow existed. Idempotent — only touches documents missing the field.
 */
async function main() {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);

  const publishedResult = await Question.updateMany(
    { review_status: { $exists: false }, is_published: true },
    { $set: { review_status: 'published' } },
  );
  const draftResult = await Question.updateMany(
    { review_status: { $exists: false }, is_published: { $ne: true } },
    { $set: { review_status: 'draft' } },
  );

  console.log(
    `Backfilled review_status: ${publishedResult.modifiedCount} published, ${draftResult.modifiedCount} draft.`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
