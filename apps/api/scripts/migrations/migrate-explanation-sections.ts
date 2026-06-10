import 'dotenv/config';
import dns from 'node:dns';
import mongoose from 'mongoose';
import { parseLegacyExplanation } from '@ibas/shared-types';
import { Question } from '../../src/domains/questions/models/Question.model.js';
import { QuestionType } from '../../src/domains/questions/models/QuestionType.model.js';

function isMcqOrTf(code: string) {
  return code === 'MCQ' || code === 'TF';
}

async function main() {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
  dns.setDefaultResultOrder('ipv4first');

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is required');

  await mongoose.connect(uri);
  const collection = mongoose.connection.collection('question_answer_details');
  const docs = await collection.find({}).toArray();

  let migrated = 0;
  let cleaned = 0;

  for (const doc of docs) {
    const question = await Question.findById(doc.question_id);
    if (!question) continue;

    const qType = await QuestionType.findById(question.question_type_id);
    const isOptionQuestion = Boolean(qType?.has_options && isMcqOrTf(question.question_type_code));
    const update: Record<string, unknown> = {};
    const unset: Record<string, ''> = {};

    if (isOptionQuestion) {
      const legacyText = String(doc.explanation ?? '').trim();
      if (legacyText && !doc.explanation_sections?.length) {
        update.explanation_sections = parseLegacyExplanation(legacyText);
      }
      unset.explanation = '';
      unset.model_answer_sections = '';
      unset.model_answer = '';
    } else {
      unset.explanation = '';
      unset.explanation_sections = '';

      if (!doc.model_answer_sections?.length) {
        const legacyModel = String(doc.model_answer ?? '').trim();
        if (legacyModel) {
          update.model_answer_sections = parseLegacyExplanation(legacyModel);
        }
      }
      unset.model_answer = '';
    }

    if (Object.keys(update).length || Object.keys(unset).length) {
      await collection.updateOne(
        { _id: doc._id },
        {
          ...(Object.keys(update).length ? { $set: update } : {}),
          ...(Object.keys(unset).length ? { $unset: unset } : {}),
        },
      );
      if (Object.keys(update).length) migrated += 1;
      if (!isOptionQuestion && doc.explanation_sections?.length) cleaned += 1;
    }
  }

  console.log(`Migrated ${migrated} record(s); removed explanation data from ${cleaned} non-MCQ/TF record(s).`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
