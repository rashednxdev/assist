import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { Question } from '../../src/domains/questions/models/Question.model.js';

/**
 * Backfill status_changed_by for questions created before "who set the current review_status"
 * was tracked. Best guess for pre-existing rows: whoever published it (reviewed_by) if published,
 * otherwise whoever created it. Idempotent — only touches documents missing the field.
 */
async function main() {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);

  const publishedResult = await Question.updateMany(
    { status_changed_by: { $exists: false }, reviewed_by: { $exists: true } },
    [{ $set: { status_changed_by: '$reviewed_by' } }],
  );
  const restResult = await Question.updateMany(
    { status_changed_by: { $exists: false }, reviewed_by: { $exists: false } },
    [{ $set: { status_changed_by: '$created_by' } }],
  );

  console.log(
    `Backfilled status_changed_by: ${publishedResult.modifiedCount} from reviewed_by, ${restResult.modifiedCount} from created_by.`,
  );
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
