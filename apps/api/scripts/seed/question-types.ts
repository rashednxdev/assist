import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { QuestionType } from '../../src/domains/questions/models/QuestionType.model.js';
import { Question } from '../../src/domains/questions/models/Question.model.js';
import { ensureQuestionTypes } from './questions-data.js';

/** Upsert standard question types only — safe to re-run, does not seed sample questions. */
async function seedQuestionTypes() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI required');

  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');
  await mongoose.connect(uri);
  await ensureQuestionTypes();

  const active = await QuestionType.find({ is_active: true }).sort({ name: 1 });
  const counts = await Question.aggregate<{ _id: mongoose.Types.ObjectId; count: number }>([
    { $match: { is_active: true } },
    { $group: { _id: '$question_type_id', count: { $sum: 1 } } },
  ]);
  const countById = new Map(counts.map((c) => [String(c._id), c.count]));
  for (const t of active) {
    console.log(`  ${t.name} [${t.code}] — ${countById.get(String(t._id)) ?? 0} questions`);
  }

  await mongoose.disconnect();
  console.log('Question types seed complete');
}

seedQuestionTypes().catch((err) => {
  console.error(err);
  process.exit(1);
});
