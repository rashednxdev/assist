import { SubscriptionPlan } from '../../src/domains/subscription/models/SubscriptionPlan.model.js';

const PLANS = [
  {
    name: 'Free Starter',
    code: 'FREE',
    description: 'Browse rules library and basic exam information.',
    price_bdt: 0,
    duration_days: 365,
    features: ['GFR rule library', 'Exam program browse', 'Limited practice questions'],
    sort_order: 1,
  },
  {
    name: 'Exam Assistant',
    code: 'EXAM',
    description: 'Full access for promotion exam preparation.',
    price_bdt: 500,
    duration_days: 90,
    features: [
      'All question banks',
      'Practice papers',
      'Syllabus mapping',
      'Progress tracking',
    ],
    sort_order: 2,
  },
  {
    name: 'Office Pro',
    code: 'PRO',
    description: 'For government offices managing pay & receipt compliance.',
    price_bdt: 1200,
    duration_days: 365,
    features: [
      'Everything in Exam Assistant',
      'Workflow task guides',
      'Regulation alerts',
      'Priority support',
    ],
    sort_order: 3,
  },
] as const;

export async function seedSubscriptionPlans() {
  for (const p of PLANS) {
    let row = await SubscriptionPlan.findOne({ code: p.code });
    if (!row) {
      row = await SubscriptionPlan.create({ ...p, is_active: true });
      console.log(`Created subscription plan: ${p.code}`);
    } else {
      Object.assign(row, p);
      await row.save();
    }
  }
}
